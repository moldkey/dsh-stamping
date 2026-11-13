/**
 * dsh-stamping — 冲压力计算与冲压 DFM
 */

export const name = "dsh-stamping";
export const inject = ["tools"];

const NL = String.fromCharCode(10);
const SITE = "https://deepseekbase.com/zh/tools/";
const TEXT_OUTPUT = {
  schema: { type: "object", additionalProperties: false, properties: { text: { type: "string" } }, required: ["text"] },
  render: (_args, value) => [{ type: "text", text: (value && value.text) || "" }],
};

const TAU = { "carbon steel": 350, "stainless": 450, aluminum: 150, copper: 220, brass: 300 };
function n(v, d) { const x = Number(v); return Number.isFinite(x) ? x : d; }
function f(x) { return (Math.round(x * 100) / 100).toString(); }

const TOOLS = {
  stamping_force: {
    description: "冲裁力计算：按周长/厚度/材料抗剪强度估算冲裁力与所需吨位",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        perimeter_mm: { type: "number", description: "冲裁轮廓周长 mm" },
        thickness: { type: "number", description: "板厚 mm" },
        material: { type: "string", enum: ["carbon steel", "stainless", "aluminum", "copper", "brass"], description: "材料" },
        safety: { type: "number", description: "安全系数，默认 1.3" },
      },
      required: ["perimeter_mm", "thickness", "material"],
    },
    run(args) {
      const L = n(args.perimeter_mm, 0), T = n(args.thickness, 0);
      const tau = TAU[String(args.material || "carbon steel")] || 350;
      if (L <= 0 || T <= 0) throw new Error("周长与板厚必须大于 0");
      const k = n(args.safety, 1.3);
      const forceN = L * T * tau * k;
      const kN = forceN / 1000;
      const ton = kN / 9.81;
      return ["冲裁力计算", "=".repeat(52), "周长: " + f(L) + " mm", "板厚: " + f(T) + " mm", "材料: " + String(args.material),
        "抗剪强度 τ: " + tau + " MPa", "安全系数: " + k, "", "冲裁力: " + Math.round(kN) + " kN ≈ " + f(ton) + " 吨",
        "建议压力机: ≥ " + Math.ceil(ton / 10) * 10 + " 吨", "", "τ 为常用参考值，实际按材料状态与模具间隙取值。", "",
        "更多工具：" + SITE].join(NL);
    },
  },
  stamping_dfm: {
    description: "冲压 DFM：最小孔径、孔边距、孔到折弯、折弯半径检查",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        thickness: { type: "number", description: "板厚 mm" },
        hole_dia: { type: "number", description: "最小孔径 mm" },
        hole_to_edge: { type: "number", description: "孔到边距离 mm（可选）" },
        hole_to_bend: { type: "number", description: "孔到折弯距离 mm（可选）" },
        bend_radius: { type: "number", description: "折弯内半径 mm（可选）" },
      },
      required: ["thickness", "hole_dia"],
    },
    run(args) {
      const T = n(args.thickness, 0), D = n(args.hole_dia, 0);
      if (T <= 0) throw new Error("板厚必须大于 0");
      const lines = ["冲压 DFM 检查", "=".repeat(52), "板厚: " + f(T) + " mm", "最小孔径: " + f(D) + " mm", ""];
      let pass = true;
      const rule = (name, ok, detail) => { if (!ok) pass = false; lines.push((ok ? "PASS " : "FAIL ") + name + " — " + detail); };
      rule("孔径 ≥ 板厚", D >= T, "需 ≥ " + f(T) + " mm");
      if (args.hole_to_edge != null) rule("孔边距 ≥ 1.5T", n(args.hole_to_edge, 0) >= 1.5 * T, "需 ≥ " + f(1.5 * T) + " mm");
      if (args.hole_to_bend != null) rule("孔到折弯 ≥ 2.5T+R", n(args.hole_to_bend, 0) >= 2.5 * T + n(args.bend_radius, 0), "需 ≥ " + f(2.5 * T + n(args.bend_radius, 0)) + " mm");
      if (args.bend_radius != null) rule("折弯半径 ≥ 板厚", n(args.bend_radius, 0) >= T, "需 ≥ " + f(T) + " mm（低碳钢）");
      lines.push("");
      lines.push(pass ? "结论：按给定规则可冲压" : "结论：存在风险，建议调整");
      lines.push("规则为常见经验值，量产前以模具厂 DFM 为准。");
      lines.push("");
      lines.push("更多工具：" + SITE);
      return lines.join(NL);
    },
  },
};

export function apply(ctx, config) {
  void config;
  for (const name of Object.keys(TOOLS)) {
    const t = TOOLS[name];
    ctx.tools.register({
      name: name,
      description: t.description,
      parameters: t.parameters,
      output: TEXT_OUTPUT,
      async execute(args) { try { return { text: t.run(args || {}) }; } catch (e) { return { text: "处理失败: " + String((e && e.message) || e) }; } },
    });
  }
}
