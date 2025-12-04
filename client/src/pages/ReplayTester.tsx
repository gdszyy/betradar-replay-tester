/**
 * UOF Replay Tester - Main Page
 * Three-column layout with bottom playback control bar
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Play, 
  Pause, 
  Square, 
  Plus, 
  Trash2, 
  RefreshCw,
  Activity,
  Clock,
  Zap
} from "lucide-react";
import { toast } from "sonner";

interface Message {
  id: number;
  messageType: string;
  producer?: string | null;
  messageTimestamp?: Date | string | null;
  matchId?: string | null;
  routingKey?: string | null;
  rawContent?: string | null;
  parsedData?: string | null;
  receivedAt: Date | string;
  sessionId?: number | null;
}

export default function ReplayTester() {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [replayStatus, setReplayStatus] = useState<string>("idle");
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(10);
  const [newMatchId, setNewMatchId] = useState<string>("");
  const [selectedMatchFilter, setSelectedMatchFilter] = useState<string>("all");

  // tRPC queries
  const { data: allMessages, refetch: refetchMessages } = trpc.db.getAllMessages.useQuery(
    { limit: 100 },
    { refetchInterval: 5000 }
  );

  const { data: replayStatusData } = trpc.replay.getStatus.useQuery(undefined, {
    refetchInterval: 2000,
  });

  const { data: playlist } = trpc.replay.getPlaylist.useQuery(undefined, {
    refetchInterval: 3000,
  });

  // tRPC mutations
  const startReplay = trpc.replay.start.useMutation({
    onSuccess: () => {
      toast.success("Replay started");
      setReplayStatus("playing");
    },
    onError: (error) => {
      toast.error(`Failed to start replay: ${error.message}`);
    },
  });

  const stopReplay = trpc.replay.stop.useMutation({
    onSuccess: () => {
      toast.success("Replay stopped");
      setReplayStatus("stopped");
    },
    onError: (error) => {
      toast.error(`Failed to stop replay: ${error.message}`);
    },
  });

  const resetReplay = trpc.replay.reset.useMutation({
    onSuccess: () => {
      toast.success("Replay reset");
      setReplayStatus("idle");
    },
    onError: (error) => {
      toast.error(`Failed to reset replay: ${error.message}`);
    },
  });

  const addToPlaylist = trpc.replay.addToPlaylist.useMutation({
    onSuccess: () => {
      toast.success("Match added to playlist");
      setNewMatchId("");
    },
    onError: (error) => {
      toast.error(`Failed to add match: ${error.message}`);
    },
  });

  const removeFromPlaylist = trpc.replay.removeFromPlaylist.useMutation({
    onSuccess: () => {
      toast.success("Match removed from playlist");
    },
    onError: (error) => {
      toast.error(`Failed to remove match: ${error.message}`);
    },
  });

  // WebSocket connection
  useWebSocket({
    onMessage: (data: any) => {
      console.log("Received message via WebSocket:", data);
      // Add new message to the list
      if (data.message_type) {
        const newMessage: Message = {
          id: Date.now(),
          messageType: data.message_type,
          producer: data.producer,
          messageTimestamp: data.message_timestamp,
          matchId: data.match_id,
          routingKey: data.routing_key,
          rawContent: data.raw_content,
          parsedData: data.parsed_data,
          receivedAt: new Date().toISOString(),
        };
        setMessages((prev) => [newMessage, ...prev].slice(0, 100));
      }
    },
    onReplayStatus: (status: any) => {
      console.log("Received replay status:", status);
      setReplayStatus(status.status || "unknown");
    },
  });

  // Update messages from database
  useEffect(() => {
    if (allMessages) {
      setMessages(allMessages as Message[]);
    }
  }, [allMessages]);

  // Update replay status
  useEffect(() => {
    if (replayStatusData?.status) {
      setReplayStatus(replayStatusData.status);
    }
  }, [replayStatusData]);

  // Handle playback control
  const handlePlay = () => {
    startReplay.mutate({
      speed: playbackSpeed,
      maxDelay: 10000,
      useReplayTimestamp: false,
    });
  };

  const handlePause = () => {
    stopReplay.mutate();
  };

  const handleStop = () => {
    resetReplay.mutate();
  };

  const handleAddMatch = () => {
    if (!newMatchId.trim()) {
      toast.error("Please enter a match ID");
      return;
    }
    addToPlaylist.mutate({
      eventId: newMatchId.trim(),
      eventType: "match",
    });
  };

  const handleRemoveMatch = (eventId: string) => {
    removeFromPlaylist.mutate({
      eventId,
      eventType: "match",
    });
  };

  // Filter messages
  const filteredMessages = selectedMatchFilter === "all" 
    ? messages 
    : messages.filter((msg) => msg.matchId === selectedMatchFilter);

  // Get message type color
  const getMessageTypeColor = (type: string): string => {
    const colorMap: Record<string, string> = {
      odds_change: "bg-blue-500/20 text-blue-400 border-blue-500/50",
      bet_stop: "bg-red-500/20 text-red-400 border-red-500/50",
      bet_settlement: "bg-green-500/20 text-green-400 border-green-500/50",
      bet_cancel: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
      fixture_change: "bg-purple-500/20 text-purple-400 border-purple-500/50",
      default: "bg-gray-500/20 text-gray-400 border-gray-500/50",
    };
    return colorMap[type] || colorMap.default;
  };

  // Get status color
  const getStatusColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      playing: "bg-green-500",
      stopped: "bg-red-500",
      idle: "bg-gray-500",
      setting_up: "bg-yellow-500",
    };
    return colorMap[status] || colorMap.idle;
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="h-14 border-b border-border flex items-center px-4 bg-card">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">UOF Replay 测试系统</h1>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">状态:</span>
            <Badge variant="outline" className="gap-2">
              <div className={`w-2 h-2 rounded-full ${getStatusColor(replayStatus)}`} />
              {replayStatus}
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content - Three Columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Replay List */}
        <div className="w-80 border-r border-border flex flex-col bg-card">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold mb-3">回放列表</h2>
            <div className="flex gap-2">
              <Input
                placeholder="输入比赛 ID (如: 12345678)"
                value={newMatchId}
                onChange={(e) => setNewMatchId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddMatch();
                  }
                }}
              />
              <Button size="icon" onClick={handleAddMatch}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {playlist?.events && playlist.events.length > 0 ? (
                playlist.events.map((event: any, index: number) => (
                  <Card key={index} className="p-3 hover:bg-accent/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {event.id || `Match ${index + 1}`}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {event.type || "match"}
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        onClick={() => handleRemoveMatch(event.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))
              ) : (
                <div className="text-center text-muted-foreground text-sm py-8">
                  暂无比赛
                  <br />
                  添加比赛 ID 开始
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 border-t border-border space-y-2">
            <Button
              className="w-full"
              variant="outline"
              onClick={() => refetchMessages()}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              刷新消息
            </Button>
          </div>
        </div>

        {/* Middle Panel - Message Log */}
        <div className="flex-1 flex flex-col bg-background">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold">消息日志</h2>
            <Select value={selectedMatchFilter} onValueChange={setSelectedMatchFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="筛选比赛" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部消息</SelectItem>
                {Array.from(new Set(messages.map((m) => m.matchId).filter(Boolean))).map(
                  (matchId) => (
                    <SelectItem key={matchId} value={matchId!}>
                      {matchId}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {filteredMessages.length > 0 ? (
                filteredMessages.map((message) => (
                  <Card
                    key={message.id}
                    className={`p-3 cursor-pointer transition-all hover:shadow-md ${
                      selectedMessage?.id === message.id
                        ? "ring-2 ring-primary"
                        : ""
                    }`}
                    onClick={() => setSelectedMessage(message)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            variant="outline"
                            className={`${getMessageTypeColor(message.messageType)}`}
                          >
                            {message.messageType}
                          </Badge>
                          {message.producer && (
                            <span className="text-xs text-muted-foreground">
                              {message.producer}
                            </span>
                          )}
                        </div>
                        {message.matchId && (
                          <div className="text-sm text-muted-foreground mb-1">
                            Match: {message.matchId}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {new Date(message.receivedAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-12">
                  暂无消息
                  <br />
                  <span className="text-xs">启动 Replay 后将接收消息</span>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - Message Details */}
        <div className="w-96 border-l border-border flex flex-col bg-card">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold">消息详情</h2>
          </div>

          {selectedMessage ? (
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">基本信息</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">类型:</span>
                      <span>{selectedMessage.messageType}</span>
                    </div>
                    {selectedMessage.producer && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">生产者:</span>
                        <span>{selectedMessage.producer}</span>
                      </div>
                    )}
                    {selectedMessage.matchId && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">比赛 ID:</span>
                        <span>{selectedMessage.matchId}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">接收时间:</span>
                      <span>{new Date(selectedMessage.receivedAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {selectedMessage.routingKey && (
                  <>
                    <div>
                      <h3 className="text-sm font-medium mb-2">路由键</h3>
                      <code className="text-xs bg-muted p-2 rounded block break-all">
                        {selectedMessage.routingKey}
                      </code>
                    </div>
                    <Separator />
                  </>
                )}

                {selectedMessage.parsedData && (
                  <>
                    <div>
                      <h3 className="text-sm font-medium mb-2">解析数据</h3>
                      <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-48">
                        {JSON.stringify(JSON.parse(selectedMessage.parsedData), null, 2)}
                      </pre>
                    </div>
                    <Separator />
                  </>
                )}

                {selectedMessage.rawContent && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">原始内容</h3>
                    <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96">
                      {selectedMessage.rawContent}
                    </pre>
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              选择一条消息查看详情
            </div>
          )}
        </div>
      </div>

      {/* Bottom Playback Control Bar */}
      <div className="h-20 border-t border-border bg-card px-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant={replayStatus === "playing" ? "default" : "outline"}
            onClick={handlePlay}
            disabled={replayStatus === "playing"}
          >
            <Play className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={handlePause}
            disabled={replayStatus !== "playing"}
          >
            <Pause className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={handleStop}>
            <Square className="w-4 h-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-8" />

        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">速度:</span>
          <Select
            value={playbackSpeed.toString()}
            onValueChange={(value) => setPlaybackSpeed(Number(value))}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1x</SelectItem>
              <SelectItem value="2">2x</SelectItem>
              <SelectItem value="5">5x</SelectItem>
              <SelectItem value="10">10x</SelectItem>
              <SelectItem value="20">20x</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            消息数: <span className="text-foreground font-medium">{messages.length}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            播放列表: <span className="text-foreground font-medium">{playlist?.events?.length || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
