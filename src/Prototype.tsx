import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Cross2Icon,
  FileTextIcon,
  MixerHorizontalIcon,
  PauseIcon,
  PlayIcon,
  ReloadIcon,
  SpeakerLoudIcon,
} from "@radix-ui/react-icons";

type Tone = "yellow" | "orange" | "red" | "purple" | "plain";
type TreeNode = { id: string; title: string; body: string[]; children: TreeNode[]; tone: Tone };

const EMPTY_ROOT: TreeNode = { id: "root", title: "面试话术", body: [], children: [], tone: "plain" };

function toneFor(text: string): Tone {
  if (/红线|禁止|不得|不能|失败|错误|幻觉|风险|异常|越权/.test(text)) return "red";
  if (/\*\*|💡|原则|结论|一句话/.test(text)) return "yellow";
  if (/重点|关键|核心|目标|结果|成果|指标|优先级|难点|坑/.test(text)) return "orange";
  if (/Agent|RAG|Prompt|Workflow|Skill|模型|工具|评测/i.test(text)) return "purple";
  return "plain";
}

function clean(text: string) {
  return text.replace(/^>\s*/, "").replace(/\*\*/g, "").replace(/^#+\s*/, "").trim();
}

function parseMindMap(text: string, prefix: string): TreeNode {
  const lines = text.split("\n");
  const first = lines.findIndex((line) => line.trim());
  if (first < 0) return EMPTY_ROOT;
  const root: TreeNode = { id: `${prefix}-0`, title: clean(lines[first]), body: [], children: [], tone: toneFor(lines[first]) };
  const stack: TreeNode[] = [root];
  let serial = 1;

  for (let index = first + 1; index < lines.length; index += 1) {
    const raw = lines[index];
    const trimmed = raw.trim();
    const indent = raw.length - raw.trimStart().length;
    if (trimmed && indent >= 8) {
      const depth = Math.max(1, Math.floor(indent / 8));
      const node: TreeNode = { id: `${prefix}-${serial++}`, title: clean(trimmed), body: [], children: [], tone: toneFor(trimmed) };
      const parent = stack[Math.min(depth - 1, stack.length - 1)] || root;
      parent.children.push(node);
      stack.splice(depth);
      stack[depth] = node;
    } else {
      const target = stack[stack.length - 1] || root;
      target.body.push(raw);
    }
  }
  return nameSubtopics(compactTree(root));
}

function compactTree(node: TreeNode): TreeNode {
  const children = node.children.map(compactTree);
  const kept: TreeNode[] = [];
  const body = [...node.body];

  for (const child of children) {
    const isProseLeaf = child.children.length === 0 &&
      (child.title.length > 28 || /[。；，：]$/.test(child.title));
    if (isProseLeaf) body.push(child.title, ...child.body);
    else kept.push(child);
  }
  return { ...node, body, children: kept };
}

function inferredTopic(text: string): string {
  const rules: Array<[RegExp, string]> = [
    [/权限.*工具|工具.*权限/, "工具权限与调用控制"],
    [/工具.*(错误|失败|误调用)|异常.*工具/, "工具异常与恢复"],
    [/RAG.*Trace|召回.*追踪|检索.*追踪/i, "RAG 检索追踪"],
    [/RAG|知识库|召回|检索/i, "RAG 与知识检索"],
    [/离线.*(回归|评测)|评测集/, "离线评测与回归"],
    [/UAT|验收/, "业务验收（UAT）"],
    [/Agent.*Workflow|Workflow.*Agent/i, "Agent 与 Workflow 选择"],
    [/多\s*Agent|编排|任务拆解/i, "多 Agent 任务编排"],
    [/记忆|上下文/, "上下文与记忆管理"],
    [/指标|Hit Rate|Recall|Precision|Top K/i, "评测与召回指标"],
    [/结构化.*非结构化|非结构化.*结构化/, "结构化与非结构化数据"],
    [/Chunk|切片/i, "知识切片设计"],
    [/风险|红线|禁止|不能/, "风险与使用边界"],
    [/项目.*阶段|演进/, "项目演进过程"],
    [/面试|话术/, "面试表达要点"],
    [/用户|场景|需求/, "用户场景与需求"],
    [/目标|成果|价值/, "项目目标与业务价值"],
    [/数据|字段|接口/, "数据与接口处理"],
  ];
  return rules.find(([pattern]) => pattern.test(text))?.[1] || `${clean(text).slice(0, 18)}…`;
}

function nameSubtopics(node: TreeNode): TreeNode {
  const children = node.children.map(nameSubtopics);
  const generic = /^(内容|说明|其他|补充|子主题|未命名|相关内容|问题)$/.test(node.title.trim());
  if (!generic && node.title.length <= 28) return { ...node, children };
  const source = [node.title, ...node.body, ...children.slice(0, 3).map((child) => child.title)].join(" ");
  const inferred = inferredTopic(source);
  if (inferred === node.title) return { ...node, children };
  return { ...node, title: inferred, body: [node.title, ...node.body], children, tone: toneFor(source) };
}

function findNode(root: TreeNode, title: string): TreeNode | undefined {
  if (root.title === title) return root;
  for (const child of root.children) {
    const match = findNode(child, title);
    if (match) return match;
  }
}

function flatten(root: TreeNode): TreeNode[] {
  return [root, ...root.children.flatMap(flatten)];
}

function spokenText(node: TreeNode): string {
  return clean([node.title, ...node.body, ...node.children.map(spokenText)].join("\n"));
}

function OriginalSection({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  return (
    <section className={`original-section original-depth-${Math.min(depth, 5)}`}>
      {depth > 0 && <h3 className={`tone-${node.tone}`}>{node.title}</h3>}
      {node.body.map((line, index) => line.trim()
        ? <p className={`tone-${toneFor(line)}`} key={index}>{clean(line)}</p>
        : <br key={index} />)}
      {node.children.map((child) => <OriginalSection node={child} depth={depth + 1} key={child.id} />)}
    </section>
  );
}

function Branch({ nodes, path, selectedId, expanded, onSelect }: {
  nodes: TreeNode[];
  path: number[];
  selectedId: string;
  expanded: Set<string>;
  onSelect: (node: TreeNode) => void;
}) {
  return nodes.map((node, index) => {
    const number = [...path, index + 1].join(".");
    const open = expanded.has(node.id);
    return (
      <div className={`tree-branch depth-${Math.min(path.length + 1, 6)}`} key={node.id}>
        <button
          className={`tree-row tone-${node.tone} ${selectedId === node.id ? "active" : ""}`}
          aria-expanded={node.children.length ? open : undefined}
          onClick={() => onSelect(node)}
        >
          <span className="tree-number">{number}</span>
          <b>{node.title || "未命名节点"}</b>
          {node.children.length ? (open ? <ChevronDownIcon /> : <ChevronRightIcon />) : <span className="leaf-dot" />}
        </button>
        {selectedId === node.id && (
          <div className="node-original-preview">
            <strong>原文</strong>
            <p>{spokenText(node)}</p>
          </div>
        )}
        {open && node.children.length > 0 && (
          <div className="tree-children">
            <Branch nodes={node.children} path={[...path, index + 1]} selectedId={selectedId} expanded={expanded} onSelect={onSelect} />
          </div>
        )}
      </div>
    );
  });
}

function stopSpeech() {
  if (typeof window !== "undefined") window.speechSynthesis.cancel();
}

export default function Prototype() {
  const [rawText, setRawText] = useState("面试话术");
  const [cmbText, setCmbText] = useState("招行");
  const [cmbImageText, setCmbImageText] = useState("招行图片内容");
  const [selectedId, setSelectedId] = useState("root");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState<"map" | "text">("map");
  const [speed, setSpeed] = useState(1);
  const [voiceNotice, setVoiceNotice] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<number | null>(null);

  const root = useMemo(() => {
    const parsed = parseMindMap(rawText, "main");
    const project = parsed.children.find((child) => child.title === "项目");
    const cmb = parseMindMap(cmbText, "cmb");
    const imageSupplement = parseMindMap(cmbImageText, "cmb-image");
    cmb.children.push(...imageSupplement.children);
    if (project && !project.children.some((child) => child.title === "招行")) project.children.push(cmb);
    return parsed;
  }, [rawText, cmbText, cmbImageText]);
  const allNodes = useMemo(() => flatten(root), [root]);
  const selected = allNodes.find((node) => node.id === selectedId) || root;
  const currentBody = spokenText(selected);
  const duration = useMemo(() => Math.max(38, Math.round(currentBody.length / (4.1 * speed))), [currentBody, speed]);

  useEffect(() => {
    const asset = (name: string) => `${import.meta.env.BASE_URL}${name}`;
    fetch(asset("pasted-text.txt")).then((response) => response.text()).then(setRawText).catch(() => undefined);
    fetch(asset("cmb.txt")).then((response) => response.text()).then(setCmbText).catch(() => undefined);
    fetch(asset("cmb-image-supplement.txt")).then((response) => response.text()).then(setCmbImageText).catch(() => undefined);
  }, []);
  useEffect(() => {
    const project = root.children.find((child) => child.title === "项目");
    const cmb = findNode(root, "招行");
    setExpanded(new Set([root.id, ...(project ? [project.id] : []), ...(cmb ? [cmb.id] : [])]));
    if (project) setSelectedId(project.id);
  }, [root]);
  useEffect(() => () => stopSpeech(), []);
  useEffect(() => { setElapsed(0); stopSpeech(); setPlaying(false); }, [selectedId]);
  useEffect(() => {
    if (!playing) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      return;
    }
    timerRef.current = window.setInterval(() => setElapsed((value) => Math.min(duration, value + 1)), 1000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [playing, duration]);

  function selectNode(node: TreeNode) {
    setSelectedId(node.id);
    if (node.children.length) setExpanded((current) => {
      const next = new Set(current);
      next.has(node.id) ? next.delete(node.id) : next.add(node.id);
      return next;
    });
  }

  function speak() {
    if (playing) { window.speechSynthesis.pause(); setPlaying(false); return; }
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    else {
      const mandarinVoices = window.speechSynthesis.getVoices()
        .filter((voice) => /^(zh-CN|cmn-CN)/i.test(voice.lang));
      const mandarin = mandarinVoices.find((voice) => /婷婷|Ting-?Ting/i.test(voice.name)) || mandarinVoices[0];
      if (!mandarin) {
        setVoiceNotice("本机没有普通话声音，请先在系统设置中安装“婷婷”。");
        setPlaying(false);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(currentBody);
      utterance.lang = "zh-CN";
      utterance.rate = speed;
      utterance.pitch = 0.92;
      utterance.volume = 1;
      utterance.voice = mandarin;
      setVoiceNotice(`普通话：${mandarin.name}`);
      utterance.onend = () => setPlaying(false);
      stopSpeech();
      window.speechSynthesis.speak(utterance);
    }
    setPlaying(true);
  }

  function move(delta: number) {
    const index = allNodes.findIndex((node) => node.id === selected.id);
    setSelectedId(allNodes[(index + delta + allNodes.length) % allNodes.length].id);
  }

  function cycleSpeed() {
    const next = speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    if (playing) { stopSpeech(); setPlaying(false); }
  }

  const fmt = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div><h1>思维漫游</h1><p>原文层级 · 重点颜色 · 分支朗读</p></div>
        <button aria-label="朗读设置"><MixerHorizontalIcon /></button>
      </header>
      <div className="view-tabs" role="tablist">
        <button className={view === "map" ? "active" : ""} onClick={() => setView("map")}>导图</button>
        <button className={view === "text" ? "active" : ""} onClick={() => setView("text")}><FileTextIcon />原文</button>
      </div>

      <div className="app-scroll">
        {view === "map" ? (
          <main className="tree-map" aria-label="面试话术多层思维导图">
            <div className="tree-summary"><div><small>思维导图</small><h2>{root.title}</h2></div><span>{root.children.length} 个主分支<br />{allNodes.length} 个节点</span></div>
            <div className="color-legend"><span className="yellow">重点</span><span className="orange">关键</span><span className="red">风险</span><span className="purple">AI / 技术</span></div>
            <div className="tree-pan" aria-label="可横向滑动的导图画布">
              <div className="tree-list"><Branch nodes={root.children} path={[]} selectedId={selected.id} expanded={expanded} onSelect={selectNode} /></div>
            </div>
            <div className="scroll-spacer" />
          </main>
        ) : (
          <main className="original-text">
            <div className={`text-heading tone-${selected.tone}`}><span>当前节点</span><h2>{selected.title}</h2></div>
            <OriginalSection node={selected} />
            {selected.children.length > 0 && <div className="subtree-note">已显示并朗读当前分支下的全部原文</div>}
            <div className="scroll-spacer" />
          </main>
        )}
      </div>

      <section className="player" aria-label="朗读播放器">
        <div className="now-playing"><SpeakerLoudIcon /><span>当前节点</span><b>{selected.title}</b></div>
        <div className="track-title">{selected.children.length ? `包含 ${selected.children.length} 个子分支` : "叶子节点"}</div>
        {voiceNotice && <div className="voice-notice">{voiceNotice}</div>}
        <input aria-label="播放进度" type="range" min="0" max={duration} value={elapsed} onChange={(event) => setElapsed(Number(event.target.value))} />
        <div className="times"><span>{fmt(elapsed)}</span><span>-{fmt(Math.max(0, duration - elapsed))}</span></div>
        <div className="transport">
          <button onClick={() => move(-1)} aria-label="上一节点"><ChevronLeftIcon /><small>上一节点</small></button>
          <button onClick={() => setElapsed(Math.max(0, elapsed - 15))} aria-label="后退十五秒"><ReloadIcon /><small>−15 秒</small></button>
          <button className="play" onClick={speak} aria-label={playing ? "暂停" : "播放"}>{playing ? <PauseIcon /> : <PlayIcon />}</button>
          <button onClick={() => setElapsed(Math.min(duration, elapsed + 15))} aria-label="前进十五秒"><ReloadIcon className="forward" /><small>+15 秒</small></button>
          <button onClick={() => move(1)} aria-label="下一节点"><ChevronRightIcon /><small>下一节点</small></button>
        </div>
        <div className="player-tools">
          <button onClick={cycleSpeed}><b>{speed}x</b><span>倍速</span></button>
          <div className="voice-fixed" title="固定使用普通话声音：婷婷"><SpeakerLoudIcon /><span>婷婷</span></div>
          <button onClick={() => { stopSpeech(); setPlaying(false); setElapsed(0); }}><Cross2Icon /><span>停止</span></button>
          <button onClick={() => setView(view === "map" ? "text" : "map")}><FileTextIcon /><span>{view === "map" ? "查看原文" : "返回导图"}</span></button>
        </div>
      </section>
    </div>
  );
}
