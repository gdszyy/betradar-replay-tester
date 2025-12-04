"""
AMQP listener for Betradar UOF messages.
Listens to the Replay MQ and forwards messages to the WebSocket server.
"""

import pika
import json
import logging
import os
import time
import requests
from typing import Optional, Dict, Any
from datetime import datetime
import xml.etree.ElementTree as ET

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
REPLAY_MQ_HOST = os.getenv("REPLAY_MQ_HOST", "global.replaymq.betradar.com")
BETRADAR_ACCESS_TOKEN = os.getenv("BETRADAR_ACCESS_TOKEN", "oIUENTCkk9nCIv92uQ")
ROUTING_KEYS = os.getenv("ROUTING_KEYS", "#")  # Listen to all messages by default
WEBSOCKET_SERVER_URL = os.getenv("WEBSOCKET_SERVER_URL", "http://localhost:3000")
DATABASE_API_URL = os.getenv("DATABASE_API_URL", "http://localhost:3000/api/trpc")


class AMQPListener:
    """AMQP listener for UOF messages."""

    def __init__(self):
        self.connection: Optional[pika.BlockingConnection] = None
        self.channel: Optional[pika.channel.Channel] = None
        self.queue_name: Optional[str] = None

    def connect(self):
        """Establish connection to AMQP server."""
        try:
            logger.info(f"Connecting to AMQP server: {REPLAY_MQ_HOST}")
            
            # Connection parameters
            credentials = pika.PlainCredentials(
                username=BETRADAR_ACCESS_TOKEN,
                password=""
            )
            
            parameters = pika.ConnectionParameters(
                host=REPLAY_MQ_HOST,
                port=5671,
                virtual_host="/",
                credentials=credentials,
                ssl_options=pika.SSLOptions(),
                heartbeat=60,
                blocked_connection_timeout=300,
            )
            
            # Establish connection
            self.connection = pika.BlockingConnection(parameters)
            self.channel = self.connection.channel()
            
            # Declare queue (server will generate a unique name)
            result = self.channel.queue_declare(queue="", exclusive=True)
            self.queue_name = result.method.queue
            
            logger.info(f"Connected to AMQP server. Queue: {self.queue_name}")
            
            # Bind queue to routing keys
            routing_keys = ROUTING_KEYS.split(",")
            for routing_key in routing_keys:
                routing_key = routing_key.strip()
                self.channel.queue_bind(
                    exchange="unifiedfeed",
                    queue=self.queue_name,
                    routing_key=routing_key
                )
                logger.info(f"Bound to routing key: {routing_key}")
            
            return True
        except Exception as e:
            logger.error(f"Failed to connect to AMQP server: {e}")
            return False

    def parse_message(self, body: bytes, routing_key: str) -> Dict[str, Any]:
        """Parse UOF message (XML format)."""
        try:
            # Decode XML
            xml_str = body.decode("utf-8")
            root = ET.fromstring(xml_str)
            
            # Extract basic info
            message_type = root.tag
            producer = root.get("producer", "unknown")
            timestamp_str = root.get("timestamp")
            
            # Parse timestamp
            message_timestamp = None
            if timestamp_str:
                try:
                    message_timestamp = datetime.fromtimestamp(int(timestamp_str) / 1000)
                except:
                    pass
            
            # Extract match ID if present
            match_id = None
            event_id = root.get("event_id")
            if event_id:
                match_id = event_id
            
            # Parse message data
            parsed_data = {
                "message_type": message_type,
                "producer": producer,
                "timestamp": timestamp_str,
                "event_id": event_id,
                "routing_key": routing_key,
            }
            
            return {
                "message_type": message_type,
                "producer": producer,
                "message_timestamp": message_timestamp,
                "match_id": match_id,
                "routing_key": routing_key,
                "raw_content": xml_str,
                "parsed_data": json.dumps(parsed_data),
            }
        except Exception as e:
            logger.error(f"Failed to parse message: {e}")
            return {
                "message_type": "unknown",
                "producer": "unknown",
                "routing_key": routing_key,
                "raw_content": body.decode("utf-8", errors="ignore"),
                "parsed_data": json.dumps({"error": str(e)}),
            }

    def save_message_to_db(self, message_data: Dict[str, Any]):
        """Save message to database via tRPC API."""
        try:
            # Prepare data for tRPC
            payload = {
                "0": {
                    "json": {
                        "messageType": message_data["message_type"],
                        "producer": message_data.get("producer"),
                        "routingKey": message_data.get("routing_key"),
                        "rawContent": message_data.get("raw_content"),
                        "parsedData": message_data.get("parsed_data"),
                        "matchId": message_data.get("match_id"),
                    }
                }
            }
            
            # Call tRPC endpoint
            response = requests.post(
                f"{DATABASE_API_URL}/db.saveMessage",
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=5
            )
            
            if response.status_code == 200:
                logger.debug("Message saved to database")
                return True
            else:
                logger.warning(f"Failed to save message to database: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Error saving message to database: {e}")
            return False

    def forward_to_websocket(self, message_data: Dict[str, Any]):
        """Forward message to WebSocket server."""
        try:
            # Send to WebSocket broadcast endpoint
            response = requests.post(
                f"{WEBSOCKET_SERVER_URL}/api/ws/broadcast",
                json={
                    "type": "message",
                    "data": message_data
                },
                timeout=2
            )
            
            if response.status_code == 200:
                logger.debug("Message forwarded to WebSocket")
                return True
            else:
                logger.warning(f"Failed to forward message to WebSocket: {response.status_code}")
                return False
        except Exception as e:
            logger.debug(f"WebSocket forward failed (this is OK if WS not running): {e}")
            return False

    def on_message(self, channel, method, properties, body):
        """Callback for received messages."""
        try:
            logger.info(f"Received message: routing_key={method.routing_key}")
            
            # Parse message
            message_data = self.parse_message(body, method.routing_key)
            
            # Save to database
            self.save_message_to_db(message_data)
            
            # Forward to WebSocket
            self.forward_to_websocket(message_data)
            
            # Acknowledge message
            channel.basic_ack(delivery_tag=method.delivery_tag)
            
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            # Acknowledge anyway to avoid redelivery
            channel.basic_ack(delivery_tag=method.delivery_tag)

    def start_consuming(self):
        """Start consuming messages."""
        try:
            if not self.channel or not self.queue_name:
                raise Exception("Not connected to AMQP server")
            
            logger.info("Starting to consume messages...")
            
            # Set up consumer
            self.channel.basic_consume(
                queue=self.queue_name,
                on_message_callback=self.on_message,
                auto_ack=False
            )
            
            # Start consuming
            self.channel.start_consuming()
            
        except KeyboardInterrupt:
            logger.info("Stopping consumer...")
            self.stop()
        except Exception as e:
            logger.error(f"Error consuming messages: {e}")
            raise

    def stop(self):
        """Stop consuming and close connection."""
        try:
            if self.channel:
                self.channel.stop_consuming()
                self.channel.close()
            if self.connection:
                self.connection.close()
            logger.info("AMQP listener stopped")
        except Exception as e:
            logger.error(f"Error stopping listener: {e}")

    def run_with_reconnect(self, max_retries: int = 10):
        """Run listener with automatic reconnection."""
        retry_count = 0
        
        while retry_count < max_retries:
            try:
                # Connect
                if not self.connect():
                    retry_count += 1
                    logger.warning(f"Connection failed. Retry {retry_count}/{max_retries}")
                    time.sleep(5)
                    continue
                
                # Reset retry count on successful connection
                retry_count = 0
                
                # Start consuming
                self.start_consuming()
                
            except KeyboardInterrupt:
                logger.info("Received interrupt signal")
                break
            except Exception as e:
                logger.error(f"Error in listener: {e}")
                retry_count += 1
                logger.warning(f"Reconnecting... Retry {retry_count}/{max_retries}")
                time.sleep(5)
            finally:
                self.stop()
        
        if retry_count >= max_retries:
            logger.error("Max retries reached. Exiting.")


def main():
    """Main entry point."""
    logger.info("Starting AMQP listener...")
    logger.info(f"AMQP Host: {REPLAY_MQ_HOST}")
    logger.info(f"Routing Keys: {ROUTING_KEYS}")
    
    listener = AMQPListener()
    listener.run_with_reconnect()


if __name__ == "__main__":
    main()
