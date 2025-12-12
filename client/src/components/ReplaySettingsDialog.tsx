/**
 * Replay Settings Dialog Component
 * Allows users to configure advanced replay parameters
 */

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings } from "lucide-react";

interface ReplaySettingsDialogProps {
  maxDelay: number;
  setMaxDelay: (value: number) => void;
  useReplayTimestamp: boolean;
  setUseReplayTimestamp: (value: boolean) => void;
  runParallel: boolean;
  setRunParallel: (value: boolean) => void;
  nodeId: string;
  setNodeId: (value: string) => void;
  product: string;
  setProduct: (value: string) => void;
}

export function ReplaySettingsDialog({
  maxDelay,
  setMaxDelay,
  useReplayTimestamp,
  setUseReplayTimestamp,
  runParallel,
  setRunParallel,
  nodeId,
  setNodeId,
  product,
  setProduct,
}: ReplaySettingsDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Replay 播放设置</DialogTitle>
          <DialogDescription>
            配置高级播放参数，这些设置将在下次点击播放时生效
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          {/* Max Delay */}
          <div className="grid gap-2">
            <Label htmlFor="maxDelay">
              最大消息延迟 (ms)
              <span className="text-xs text-muted-foreground ml-2">默认: 10000</span>
            </Label>
            <Input
              id="maxDelay"
              type="number"
              min="1000"
              max="60000"
              step="1000"
              value={maxDelay}
              onChange={(e) => setMaxDelay(Number(e.target.value))}
              placeholder="10000"
            />
            <p className="text-xs text-muted-foreground">
              两条消息之间的最大延迟时间，超过此时间将被缩短
            </p>
          </div>

          {/* Node ID */}
          <div className="grid gap-2">
            <Label htmlFor="nodeId">
              节点 ID (可选)
            </Label>
            <Input
              id="nodeId"
              type="number"
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
              placeholder="留空表示不使用"
            />
            <p className="text-xs text-muted-foreground">
              用于隔离不同开发者的 Replay 会话
            </p>
          </div>

          {/* Product */}
          <div className="grid gap-2">
            <Label htmlFor="product">
              产品过滤 (可选)
            </Label>
            <Input
              id="product"
              type="number"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="留空表示接收所有产品"
            />
            <p className="text-xs text-muted-foreground">
              只接收指定产品的消息（例如：1=LiveOdds, 3=PreMatch）
            </p>
          </div>

          {/* Use Replay Timestamp */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="useReplayTimestamp">使用当前时间戳</Label>
              <p className="text-xs text-muted-foreground">
                将消息时间戳替换为当前时间
              </p>
            </div>
            <Switch
              id="useReplayTimestamp"
              checked={useReplayTimestamp}
              onCheckedChange={setUseReplayTimestamp}
            />
          </div>

          {/* Run Parallel */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="runParallel">并行播放</Label>
              <p className="text-xs text-muted-foreground">
                队列中的每个事件独立播放
              </p>
            </div>
            <Switch
              id="runParallel"
              checked={runParallel}
              onCheckedChange={setRunParallel}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogTrigger asChild>
            <Button type="button" variant="outline">
              关闭
            </Button>
          </DialogTrigger>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
