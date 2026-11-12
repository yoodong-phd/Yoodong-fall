import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
} from "recharts";
import type { Frame } from "../types/assessment";
export default function ResultChart({ frames }: { frames: Frame[] }) {
  const valid = frames.filter((f) => f.valid);
  if (!valid.length)
    return (
      <div className="empty-state">
        유효한 관절 추적 데이터가 없습니다. 수동 측정 시간만 기록되었습니다.
      </div>
    );
  const data = valid
    .filter((_, i) => i % Math.max(1, Math.floor(valid.length / 400)) === 0)
    .map((f) => ({
      seconds: +(f.t / 1000).toFixed(2),
      hip: f.hipAngle,
      knee: f.kneeAngle,
      trunk: f.trunk,
      x: f.hipX,
      y: f.hipY,
    }));
  return (
    <div className="charts">
      <div>
        <h3>
          관절각도 변화 <small>2D · °</small>
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="seconds" unit="s" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line name="고관절" dataKey="hip" stroke="#0b998c" dot={false} />
            <Line name="무릎" dataKey="knee" stroke="#244b7c" dot={false} />
            <Line
              name="체간 기울기"
              dataKey="trunk"
              stroke="#cd8d36"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div>
        <h3>
          고관절 중심의 영상 궤적 <small>화면 좌표</small>
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <ScatterChart>
            <CartesianGrid />
            <XAxis type="number" dataKey="x" name="영상 x" />
            <YAxis type="number" dataKey="y" name="영상 y" reversed />
            <Tooltip />
            <Scatter data={data} fill="#0b998c" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
