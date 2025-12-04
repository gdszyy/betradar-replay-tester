"""
SportRader Replay Environment Controller
基于 SportRader API 的 replay 环境完整控制系统
"""

import requests
import json
import time
from typing import List, Dict, Optional, Tuple
from enum import Enum
from dataclasses import dataclass
from datetime import datetime
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ReplayStatus(Enum):
    """Replay 状态枚举"""
    PLAYING = "PLAYING"
    STOPPED = "STOPPED"
    SETTING_UP = "SETTING_UP"
    UNKNOWN = "UNKNOWN"


class EventType(Enum):
    """事件类型枚举"""
    MATCH = "sr:match"
    STAGE = "sr:stage"
    SEASON = "sr:season"
    TOURNAMENT = "sr:tournament"


@dataclass
class ReplayEvent:
    """Replay 事件数据类"""
    event_id: str
    event_type: EventType
    start_time: Optional[int] = None  # 相对于事件开始的分钟数
    
    def to_urn(self) -> str:
        """转换为 URN 格式"""
        return f"{self.event_type.value}:{self.event_id}"


@dataclass
class ReplayConfig:
    """Replay 配置数据类"""
    speed: float = 10.0  # 播放速度倍数
    max_delay: int = 10000  # 最大消息延迟（毫秒）
    use_replay_timestamp: bool = False  # 是否使用 replay 时间戳
    node_id: Optional[str] = None  # Node ID 用于区分不同开发者
    product_id: Optional[int] = None  # 产品 ID 过滤


class ReplayEnvironmentController:
    """Replay 环境控制器 - 主要控制类"""
    
    def __init__(
        self,
        access_token: str,
        base_url: str = "https://api.betradar.com/v1",
        replay_mq_host: str = "global.replaymq.betradar.com",
        timeout: int = 30
    ):
        """
        初始化 Replay 环境控制器
        
        Args:
            access_token: Betradar 访问令牌
            base_url: API 基础 URL
            replay_mq_host: Replay MQ 服务器地址
            timeout: 请求超时时间（秒）
        """
        self.access_token = access_token
        self.base_url = base_url
        self.replay_mq_host = replay_mq_host
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        })
        self.current_config = ReplayConfig()
        self.playlist: List[ReplayEvent] = []
        
        logger.info(f"初始化 Replay 环境控制器 - 服务器: {replay_mq_host}")
    
    def _make_request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict] = None,
        json_data: Optional[Dict] = None,
        expected_status: int = 200
    ) -> Tuple[bool, Dict]:
        """
        发送 HTTP 请求的通用方法
        
        Args:
            method: HTTP 方法 (GET, POST, PUT, DELETE)
            endpoint: API 端点路径
            params: 查询参数
            json_data: JSON 请求体
            expected_status: 期望的 HTTP 状态码
            
        Returns:
            (成功标志, 响应数据)
        """
        url = f"{self.base_url}{endpoint}"
        
        try:
            response = self.session.request(
                method=method,
                url=url,
                params=params,
                json=json_data,
                timeout=self.timeout
            )
            
            logger.debug(f"{method} {endpoint} - 状态码: {response.status_code}")
            
            if response.status_code == expected_status:
                try:
                    return True, response.json()
                except json.JSONDecodeError:
                    return True, {"raw": response.text}
            else:
                logger.warning(
                    f"请求失败 - 预期: {expected_status}, 实际: {response.status_code}\n"
                    f"响应: {response.text}"
                )
                return False, {"error": response.text, "status_code": response.status_code}
                
        except requests.RequestException as e:
            logger.error(f"请求异常: {str(e)}")
            return False, {"error": str(e)}
    
    def add_event_to_playlist(
        self,
        event_id: str,
        event_type: EventType = EventType.MATCH,
        start_time: Optional[int] = None
    ) -> bool:
        """
        添加事件到 replay 播放列表
        
        Args:
            event_id: 事件 ID
            event_type: 事件类型
            start_time: 开始时间（相对于事件开始的分钟数）
            
        Returns:
            是否成功
        """
        event = ReplayEvent(event_id, event_type, start_time)
        
        params = {}
        if start_time is not None:
            params["start_time"] = start_time
        
        success, response = self._make_request(
            method="PUT",
            endpoint=f"/replay/events/{event.to_urn()}",
            params=params,
            expected_status=200
        )
        
        if success:
            self.playlist.append(event)
            logger.info(f"成功添加事件到播放列表: {event.to_urn()}")
        else:
            logger.error(f"添加事件失败: {event.to_urn()} - {response}")
        
        return success
    
    def remove_event_from_playlist(
        self,
        event_id: str,
        event_type: EventType = EventType.MATCH
    ) -> bool:
        """
        从 replay 播放列表移除事件
        
        Args:
            event_id: 事件 ID
            event_type: 事件类型
            
        Returns:
            是否成功
        """
        event = ReplayEvent(event_id, event_type)
        
        success, response = self._make_request(
            method="DELETE",
            endpoint=f"/replay/events/{event.to_urn()}",
            expected_status=200
        )
        
        if success:
            self.playlist = [e for e in self.playlist if e.to_urn() != event.to_urn()]
            logger.info(f"成功从播放列表移除事件: {event.to_urn()}")
        else:
            logger.error(f"移除事件失败: {event.to_urn()} - {response}")
        
        return success
    
    def get_playlist(self) -> Tuple[bool, List[Dict]]:
        """
        获取当前 replay 播放列表
        
        Returns:
            (成功标志, 事件列表)
        """
        success, response = self._make_request(
            method="GET",
            endpoint="/replay/",
            expected_status=200
        )
        
        if success:
            logger.info(f"成功获取播放列表，包含 {len(response.get('events', []))} 个事件")
        else:
            logger.error(f"获取播放列表失败: {response}")
        
        return success, response.get("events", [])
    
    def start_replay(
        self,
        speed: float = 10.0,
        max_delay: int = 10000,
        use_replay_timestamp: bool = False,
        node_id: Optional[str] = None,
        product_id: Optional[int] = None
    ) -> bool:
        """
        开始 replay
        
        Args:
            speed: 播放速度倍数（默认 10x）
            max_delay: 最大消息延迟（毫秒，默认 10000）
            use_replay_timestamp: 是否使用 replay 时间戳
            node_id: Node ID 用于区分不同开发者
            product_id: 产品 ID 过滤
            
        Returns:
            是否成功
        """
        payload = {
            "speed": speed,
            "max_delay": max_delay,
            "use_replay_timestamp": use_replay_timestamp
        }
        
        if node_id:
            payload["node_id"] = node_id
        if product_id:
            payload["product_id"] = product_id
        
        success, response = self._make_request(
            method="POST",
            endpoint="/replay/play",
            json_data=payload,
            expected_status=200
        )
        
        if success:
            self.current_config = ReplayConfig(
                speed=speed,
                max_delay=max_delay,
                use_replay_timestamp=use_replay_timestamp,
                node_id=node_id,
                product_id=product_id
            )
            logger.info(
                f"成功启动 replay - 速度: {speed}x, 最大延迟: {max_delay}ms"
            )
        else:
            logger.error(f"启动 replay 失败: {response}")
        
        return success
    
    def stop_replay(self) -> bool:
        """
        停止 replay
        
        Returns:
            是否成功
        """
        success, response = self._make_request(
            method="POST",
            endpoint="/replay/stop",
            expected_status=200
        )
        
        if success:
            logger.info("成功停止 replay")
        else:
            logger.error(f"停止 replay 失败: {response}")
        
        return success
    
    def reset_replay(self) -> bool:
        """
        重置 replay（停止并清空播放列表）
        
        Returns:
            是否成功
        """
        success, response = self._make_request(
            method="POST",
            endpoint="/replay/reset",
            expected_status=200
        )
        
        if success:
            self.playlist = []
            logger.info("成功重置 replay - 播放列表已清空")
        else:
            logger.error(f"重置 replay 失败: {response}")
        
        return success
    
    def get_status(self) -> Tuple[bool, Dict]:
        """
        获取 replay 状态
        
        Returns:
            (成功标志, 状态信息)
        """
        success, response = self._make_request(
            method="GET",
            endpoint="/replay/status",
            expected_status=200
        )
        
        if success:
            status = response.get("status", "UNKNOWN")
            logger.info(f"Replay 状态: {status}")
        else:
            logger.error(f"获取状态失败: {response}")
        
        return success, response
    
    def get_event_summary(
        self,
        event_id: str,
        event_type: EventType = EventType.MATCH,
        language: str = "en"
    ) -> Tuple[bool, Dict]:
        """
        获取事件摘要信息
        
        Args:
            event_id: 事件 ID
            event_type: 事件类型
            language: 语言代码
            
        Returns:
            (成功标志, 事件信息)
        """
        urn_type = event_type.value.split(":")[-1]  # 提取类型部分
        
        success, response = self._make_request(
            method="GET",
            endpoint=f"/sports/{language}/sport_events/{urn_type}:{event_id}/summary.xml",
            expected_status=200
        )
        
        if success:
            logger.info(f"成功获取事件摘要: {event_type.value}:{event_id}")
        else:
            logger.error(f"获取事件摘要失败: {response}")
        
        return success, response
    
    def get_event_timeline(
        self,
        event_id: str,
        event_type: EventType = EventType.MATCH,
        language: str = "en"
    ) -> Tuple[bool, Dict]:
        """
        获取事件时间线信息
        
        Args:
            event_id: 事件 ID
            event_type: 事件类型
            language: 语言代码
            
        Returns:
            (成功标志, 时间线信息)
        """
        urn_type = event_type.value.split(":")[-1]
        
        success, response = self._make_request(
            method="GET",
            endpoint=f"/sports/{language}/sport_events/{urn_type}:{event_id}/timeline.xml",
            expected_status=200
        )
        
        if success:
            logger.info(f"成功获取事件时间线: {event_type.value}:{event_id}")
        else:
            logger.error(f"获取事件时间线失败: {response}")
        
        return success, response
    
    def list_scenarios(self) -> Tuple[bool, List[Dict]]:
        """
        列出所有可用的 replay 场景
        
        Returns:
            (成功标志, 场景列表)
        """
        success, response = self._make_request(
            method="GET",
            endpoint="/replay/scenario",
            expected_status=200
        )
        
        if success:
            scenarios = response.get("scenarios", [])
            logger.info(f"成功获取场景列表，包含 {len(scenarios)} 个场景")
        else:
            logger.error(f"获取场景列表失败: {response}")
            scenarios = []
        
        return success, scenarios
    
    def play_scenario(self, scenario_id: str) -> bool:
        """
        播放指定的 replay 场景
        
        Args:
            scenario_id: 场景 ID
            
        Returns:
            是否成功
        """
        success, response = self._make_request(
            method="POST",
            endpoint=f"/replay/scenario/play/{scenario_id}",
            expected_status=200
        )
        
        if success:
            logger.info(f"成功启动场景 replay: {scenario_id}")
        else:
            logger.error(f"启动场景 replay 失败: {response}")
        
        return success
    
    def wait_for_status(
        self,
        target_status: ReplayStatus,
        timeout: int = 60,
        poll_interval: int = 2
    ) -> bool:
        """
        等待 replay 达到指定状态
        
        Args:
            target_status: 目标状态
            timeout: 超时时间（秒）
            poll_interval: 轮询间隔（秒）
            
        Returns:
            是否成功达到目标状态
        """
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            success, response = self.get_status()
            
            if success:
                current_status = response.get("status", "UNKNOWN")
                if current_status == target_status.value:
                    logger.info(f"达到目标状态: {target_status.value}")
                    return True
            
            logger.debug(f"等待状态变化... 当前: {current_status}")
            time.sleep(poll_interval)
        
        logger.warning(f"超时未能达到目标状态: {target_status.value}")
        return False
    
    def close(self):
        """关闭会话"""
        self.session.close()
        logger.info("Replay 环境控制器已关闭")


class ReplayWorkflow:
    """Replay 工作流 - 高级操作流程"""
    
    def __init__(self, controller: ReplayEnvironmentController):
        """
        初始化工作流
        
        Args:
            controller: Replay 环境控制器实例
        """
        self.controller = controller
    
    def replay_single_match(
        self,
        match_id: str,
        speed: float = 10.0,
        max_delay: int = 10000,
        wait_for_completion: bool = False
    ) -> bool:
        """
        Replay 单场比赛的完整工作流
        
        Args:
            match_id: 比赛 ID
            speed: 播放速度
            max_delay: 最大延迟
            wait_for_completion: 是否等待完成
            
        Returns:
            是否成功
        """
        logger.info(f"开始单场比赛 replay 工作流: {match_id}")
        
        # 1. 重置 replay
        if not self.controller.reset_replay():
            return False
        
        # 2. 添加比赛到播放列表
        if not self.controller.add_event_to_playlist(match_id, EventType.MATCH):
            return False
        
        # 3. 启动 replay
        if not self.controller.start_replay(speed=speed, max_delay=max_delay):
            return False
        
        logger.info(f"比赛 {match_id} 的 replay 已启动")
        
        if wait_for_completion:
            # 等待 replay 完成（这里需要实现完成检测逻辑）
            logger.info("等待 replay 完成...")
            time.sleep(5)  # 简化的等待逻辑
        
        return True
    
    def replay_multiple_matches(
        self,
        match_ids: List[str],
        speed: float = 10.0,
        max_delay: int = 10000
    ) -> bool:
        """
        Replay 多场比赛的完整工作流
        
        Args:
            match_ids: 比赛 ID 列表
            speed: 播放速度
            max_delay: 最大延迟
            
        Returns:
            是否成功
        """
        logger.info(f"开始多场比赛 replay 工作流: {len(match_ids)} 场比赛")
        
        # 1. 重置 replay
        if not self.controller.reset_replay():
            return False
        
        # 2. 添加所有比赛到播放列表
        for match_id in match_ids:
            if not self.controller.add_event_to_playlist(match_id, EventType.MATCH):
                logger.warning(f"添加比赛 {match_id} 失败，继续处理其他比赛")
                continue
        
        # 3. 启动 replay
        if not self.controller.start_replay(speed=speed, max_delay=max_delay):
            return False
        
        logger.info(f"多场比赛 replay 已启动")
        return True
    
    def stress_test_with_scenario(self, scenario_id: str) -> bool:
        """
        使用预定义场景进行压力测试
        
        Args:
            scenario_id: 场景 ID
            
        Returns:
            是否成功
        """
        logger.info(f"开始压力测试: 场景 {scenario_id}")
        
        # 1. 列出所有场景验证
        success, scenarios = self.controller.list_scenarios()
        if not success:
            logger.error("无法获取场景列表")
            return False
        
        # 2. 播放场景
        if not self.controller.play_scenario(scenario_id):
            return False
        
        logger.info(f"压力测试场景 {scenario_id} 已启动")
        return True


if __name__ == "__main__":
    print("Replay 环境控制系统已就绪")
    print("使用示例:")
    print("  controller = ReplayEnvironmentController(access_token='your_token')")
    print("  controller.add_event_to_playlist('123456', EventType.MATCH)")
    print("  controller.start_replay(speed=10.0, max_delay=10000)")
