"""
FastAPI service for Betradar Replay control and UOF API integration.
This service wraps the replay_controller and provides HTTP endpoints.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import logging
from datetime import datetime, timedelta

# Import the replay controller
from replay_controller import (
    ReplayEnvironmentController,
    EventType,
    ReplayStatus,
    ReplayWorkflow
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="UOF Replay Service", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global replay controller instance
replay_controller: Optional[ReplayEnvironmentController] = None

# Configuration
BETRADAR_ACCESS_TOKEN = os.getenv("BETRADAR_ACCESS_TOKEN", "oIUENTCkk9nCIv92uQ")
UOF_API_BASE_URL = os.getenv("UOF_API_BASE_URL", "https://api.betradar.com/v1")


# ============ Pydantic Models ============

class MatchInfo(BaseModel):
    match_id: str
    name: Optional[str] = None
    sport_type: Optional[str] = None
    scheduled_time: Optional[str] = None
    status: Optional[str] = None
    home_team: Optional[str] = None
    away_team: Optional[str] = None


class ReplayStartRequest(BaseModel):
    speed: float = 10.0
    max_delay: int = 10000
    use_replay_timestamp: bool = False
    node_id: Optional[str] = None
    product_id: Optional[int] = None


class AddEventRequest(BaseModel):
    event_id: str
    event_type: str = "match"  # match, stage, season, tournament


class ReplayStatusResponse(BaseModel):
    status: str
    raw_status: Dict[str, Any]


# ============ Helper Functions ============

def get_controller() -> ReplayEnvironmentController:
    """Get or create the replay controller instance."""
    global replay_controller
    if replay_controller is None:
        replay_controller = ReplayEnvironmentController(
            access_token=BETRADAR_ACCESS_TOKEN
        )
    return replay_controller


def parse_event_type(event_type_str: str) -> EventType:
    """Parse event type string to EventType enum."""
    type_map = {
        "match": EventType.MATCH,
        "stage": EventType.STAGE,
        "season": EventType.SEASON,
        "tournament": EventType.TOURNAMENT,
    }
    return type_map.get(event_type_str.lower(), EventType.MATCH)


# ============ Health Check ============

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "replay_service"}


# ============ Replay Control Endpoints ============

@app.post("/replay/start")
async def start_replay(request: ReplayStartRequest):
    """Start replay with specified parameters."""
    try:
        controller = get_controller()
        success = controller.start_replay(
            speed=request.speed,
            max_delay=request.max_delay,
            use_replay_timestamp=request.use_replay_timestamp,
            node_id=request.node_id,
            product_id=request.product_id,
        )
        
        if success:
            return {"success": True, "message": "Replay started successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to start replay")
    except Exception as e:
        logger.error(f"Error starting replay: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/replay/stop")
async def stop_replay():
    """Stop the current replay."""
    try:
        controller = get_controller()
        success = controller.stop_replay()
        
        if success:
            return {"success": True, "message": "Replay stopped successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to stop replay")
    except Exception as e:
        logger.error(f"Error stopping replay: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/replay/reset")
async def reset_replay():
    """Reset replay (stop and clear playlist)."""
    try:
        controller = get_controller()
        success = controller.reset_replay()
        
        if success:
            return {"success": True, "message": "Replay reset successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to reset replay")
    except Exception as e:
        logger.error(f"Error resetting replay: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/replay/status")
async def get_replay_status():
    """Get current replay status."""
    try:
        controller = get_controller()
        success, status = controller.get_status()
        
        if success:
            return ReplayStatusResponse(
                status=status.get("status", "unknown"),
                raw_status=status
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to get replay status")
    except Exception as e:
        logger.error(f"Error getting replay status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ Playlist Management Endpoints ============

@app.post("/replay/playlist/add")
async def add_to_playlist(request: AddEventRequest):
    """Add an event to the replay playlist."""
    try:
        controller = get_controller()
        event_type = parse_event_type(request.event_type)
        success = controller.add_event_to_playlist(request.event_id, event_type)
        
        if success:
            return {"success": True, "message": f"Event {request.event_id} added to playlist"}
        else:
            raise HTTPException(status_code=500, detail="Failed to add event to playlist")
    except Exception as e:
        logger.error(f"Error adding event to playlist: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/replay/playlist/remove")
async def remove_from_playlist(request: AddEventRequest):
    """Remove an event from the replay playlist."""
    try:
        controller = get_controller()
        event_type = parse_event_type(request.event_type)
        success = controller.remove_event_from_playlist(request.event_id, event_type)
        
        if success:
            return {"success": True, "message": f"Event {request.event_id} removed from playlist"}
        else:
            raise HTTPException(status_code=500, detail="Failed to remove event from playlist")
    except Exception as e:
        logger.error(f"Error removing event from playlist: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/replay/playlist")
async def get_playlist():
    """Get the current replay playlist."""
    try:
        controller = get_controller()
        success, events = controller.get_playlist()
        
        if success:
            return {"success": True, "events": events}
        else:
            raise HTTPException(status_code=500, detail="Failed to get playlist")
    except Exception as e:
        logger.error(f"Error getting playlist: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ UOF API Endpoints ============

@app.get("/uof/match/{match_id}/summary")
async def get_match_summary(match_id: str, language: str = "en"):
    """Get match summary from UOF API."""
    try:
        controller = get_controller()
        success, summary = controller.get_event_summary(
            event_id=match_id,
            event_type=EventType.MATCH,
            language=language
        )
        
        if success:
            return {"success": True, "summary": summary}
        else:
            raise HTTPException(status_code=500, detail="Failed to get match summary")
    except Exception as e:
        logger.error(f"Error getting match summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/uof/match/{match_id}/timeline")
async def get_match_timeline(match_id: str, language: str = "en"):
    """Get match timeline from UOF API."""
    try:
        controller = get_controller()
        success, timeline = controller.get_event_timeline(
            event_id=match_id,
            event_type=EventType.MATCH,
            language=language
        )
        
        if success:
            return {"success": True, "timeline": timeline}
        else:
            raise HTTPException(status_code=500, detail="Failed to get match timeline")
    except Exception as e:
        logger.error(f"Error getting match timeline: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/uof/matches/recent")
async def get_recent_matches(hours: int = 48):
    """
    Get matches from the past N hours.
    Note: This is a simplified implementation. In production, you would
    query the UOF schedule API with proper date filters.
    """
    try:
        # Calculate the time range
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=hours)
        
        # TODO: Implement actual UOF schedule API call
        # For now, return a placeholder response
        return {
            "success": True,
            "matches": [],
            "time_range": {
                "start": start_time.isoformat(),
                "end": end_time.isoformat(),
                "hours": hours
            },
            "note": "This endpoint needs to be implemented with actual UOF schedule API"
        }
    except Exception as e:
        logger.error(f"Error getting recent matches: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ Scenarios Endpoints ============

@app.get("/replay/scenarios")
async def list_scenarios():
    """List available replay scenarios."""
    try:
        controller = get_controller()
        success, scenarios = controller.list_scenarios()
        
        if success:
            return {"success": True, "scenarios": scenarios}
        else:
            raise HTTPException(status_code=500, detail="Failed to list scenarios")
    except Exception as e:
        logger.error(f"Error listing scenarios: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/replay/scenarios/{scenario_id}/play")
async def play_scenario(scenario_id: str):
    """Play a specific scenario."""
    try:
        controller = get_controller()
        success = controller.play_scenario(scenario_id)
        
        if success:
            return {"success": True, "message": f"Scenario {scenario_id} started"}
        else:
            raise HTTPException(status_code=500, detail="Failed to play scenario")
    except Exception as e:
        logger.error(f"Error playing scenario: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ Cleanup ============

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    global replay_controller
    if replay_controller:
        replay_controller.close()
        replay_controller = None


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("REPLAY_SERVICE_PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
