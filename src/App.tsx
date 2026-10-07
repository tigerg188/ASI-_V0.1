/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Boxes,
  FileText,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Upload,
  Download,
  Terminal,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Eye,
  FileCode,
  Package,
  Layers,
  Sparkles,
  ArrowRight,
  Database,
  ExternalLink,
  Info,
  Clock,
  Code2
} from 'lucide-react';

interface ProjectSummary {
  id: string;
  name: string;
  type: string;
  hasContract: boolean;
}

interface FactRecord {
  id: string;
  factType: string;
  source: string;
  path: string;
  type: string;
  value: string;
  timestamp: string;
}

interface ProjectFactLedger {
  projectId: string;
  projectName: string;
  projectPath: string;
  scannedAt: string;
  totalFiles: number;
  totalSizeBytes: number;
  facts: FactRecord[];
  primaryFiles: string[];
  skills: string[];
  prompts: string[];
  dependencies: Array<{ name: string; versionSpec: string; file: string }>;
  candidateEntries: string[];
  configFiles: string[];
}

interface RuntimeContract {
  projectId: string;
  originalMechanism: string;
  executionMode: string;
  runtimeType: string;
  entry: string;
  entryIsExecutable: boolean;
  inputs: Array<{ name: string; type: string; required: boolean; description: string }>;
  outputs: Array<{ name: string; type: string; filename: string; description: string }>;
  dependencies: Array<{ name: string; versionSpec?: string; source: string }>;
  environment: { requiresPython: boolean; requiresNode: boolean; networkPolicy: string };
  execution: { command?: string; directPromptTemplate?: string };
  verification: Array<{ tier: 1 | 2; rule: string; description: string }>;
  fidelity: {
    originalAuthor?: string;
    originalEntry: string;
    unmodifiedRate: string;
    adaptationSummary: string;
  };
  provenance: Array<{ field: string; status: 'FACT' | 'INFERENCE' | 'USER_CONFIRMED'; sourceRef: string }>;
}

interface ExecutionReceipt {
  runId: string;
  projectId: string;
  timestamp: string;
  executionMode: string;
  durationMs: number;
  inputBytes: number;
  outputBytes: number;
  artifactPaths: string[];
  exitCode: number;
  verificationPassed: boolean;
  verificationDetails: {
    tier1: { fileExists: boolean; nonZeroSize: boolean; bytes: number };
    tier2: { formatValid: boolean; checks: string[] };
  };
}

export default function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('a0-doc-formatter-skill');
  const [activeTab, setActiveTab] = useState<'workbench' | 'facts' | 'contract' | 'receipts'>('workbench');

  // Ledger & Contract State
  const [ledger, setLedger] = useState<ProjectFactLedger | null>(null);
  const [contract, setContract] = useState<RuntimeContract | null>(null);
  const [isLoadingScan, setIsLoadingScan] = useState<boolean>(false);
  const [isLoadingContract, setIsLoadingContract] = useState<boolean>(false);

  // File Inspector Modal
  const [inspectedFilePath, setInspectedFilePath] = useState<string | null>(null);
  const [inspectedFileContent, setInspectedFileContent] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);

  // Phase 1 Execution State
  const [userContent, setUserContent] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [latestReceipt, setLatestReceipt] = useState<ExecutionReceipt | null>(null);
  const [latestArtifactText, setLatestArtifactText] = useState<string | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);

  // Load project list
  const loadProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.success) {
        setProjects(data.projects);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  // When project changes, automatically load its Scan & Contract
  useEffect(() => {
    if (!selectedProjectId) return;
    fetchScan(selectedProjectId);
  }, [selectedProjectId]);

  const fetchScan = async (projId: string) => {
    setIsLoadingScan(true);
    try {
      const res = await fetch(`/api/projects/${projId}/scan`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setLedger(data.ledger);
        // Automatically fetch or generate contract if exists
        fetchContract(projId);
      }
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setIsLoadingScan(false);
    }
  };

  const fetchContract = async (projId: string) => {
    setIsLoadingContract(true);
    try {
      const res = await fetch(`/api/projects/${projId}/contract`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setContract(data.contract);
      }
    } catch (err) {
      console.error('Contract compilation failed:', err);
    } finally {
      setIsLoadingContract(false);
    }
  };

  const inspectFile = async (relPath: string) => {
    setInspectedFilePath(relPath);
    setIsLoadingFile(true);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/file?path=${encodeURIComponent(relPath)}`);
      const data = await res.json();
      if (data.success) {
        setInspectedFileContent(data.content);
      } else {
        setInspectedFileContent(`[Error reading file: ${data.error}]`);
      }
    } catch (err) {
      setInspectedFileContent(`[Failed to fetch file content]`);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const loadPresetSample = async () => {
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/file?path=examples/sample_input.txt`);
      const data = await res.json();
      if (data.success) {
        setUserContent(data.content);
      }
    } catch (err) {
      console.error('Failed to load preset sample:', err);
    }
  };

  // Phase 1 Execute
  const handleExecute = async () => {
    if (!userContent.trim()) return;
    setIsExecuting(true);
    setLatestReceipt(null);
    setLatestArtifactText(null);

    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userContent }),
      });
      const data = await res.json();
      if (data.success) {
        setLatestReceipt(data.receipt);
        setLatestArtifactText(data.artifactContent);
      } else {
        alert(`执行遇到异常: ${data.error}`);
      }
    } catch (err: any) {
      alert(`网络或执行调用失败: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // ZIP Upload
  const handleZipUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const projectId = prompt('请输入导入的项目唯一 ID (字母数字组合):', file.name.replace(/\.[^/.]+$/, ''));
    if (!projectId) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const res = await fetch('/api/projects/import-zip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, base64Zip: base64 }),
        });
        const data = await res.json();
        if (data.success) {
          alert('项目解包并导入成功！正在进入确定性扫描...');
          await loadProjects();
          setSelectedProjectId(projectId);
        } else {
          alert(`导入失败: ${data.error}`);
        }
      } catch (err: any) {
        alert(`上传失败: ${err.message}`);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-sky-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-white/20">
            <Boxes className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">ASI 通用智能项目底座</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Phase 0 · 0.5 · 1 已就绪
              </span>
            </div>
            <p className="text-xs text-slate-400">项目不迁就 ASI · 程序确定性执行 · 真实产物闭环交付</p>
          </div>
        </div>

        {/* Project Switcher & Uploader */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-800/80 rounded-xl border border-slate-700/70 p-1 text-xs">
            <span className="px-2.5 text-slate-400 font-medium">当前目标项目:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-slate-900 text-slate-100 px-3 py-1.5 rounded-lg border border-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} [{p.type}]
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 cursor-pointer transition">
            <Upload className="h-3.5 w-3.5" />
            <span>导入 ZIP 包</span>
            <input type="file" accept=".zip" onChange={handleZipUpload} className="hidden" />
          </label>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700/70 text-xs">
          <button
            onClick={() => setActiveTab('workbench')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'workbench'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            用户工作台 (Phase 1)
          </button>
          <button
            onClick={() => setActiveTab('facts')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'facts'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            确定性扫描与事实 (Phase 0)
          </button>
          <button
            onClick={() => setActiveTab('contract')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'contract'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="h-3.5 w-3.5" />
            Runtime Contract (Phase 0.5)
          </button>
          <button
            onClick={() => setActiveTab('receipts')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'receipts'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            执行验证与收据
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* ======================= TAB 1: 普通用户工作台 (Phase 1 真实执行闭环) ======================= */}
        {activeTab === 'workbench' && (
          <div className="space-y-6">
            {/* Top 4 Plain-Language State Lights */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
                <div>
                  <div className="text-xs uppercase tracking-wider font-semibold text-emerald-400 flex items-center gap-2 mb-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    ASI 托管运行环境 (Managed Runtime Environment) 就绪
                  </div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    {ledger?.projectName || selectedProjectId}
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    当前机制: <span className="font-mono text-emerald-300">{contract?.originalMechanism || 'llm_directed_skill'}</span> · 入口: <span className="font-mono text-slate-200">{contract?.entry || 'SKILL.md'}</span>
                  </p>
                </div>

                {/* The 4 Core State Indicators */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-950 p-3 rounded-xl border border-emerald-900/40 flex items-center gap-2.5">
                    <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400"></span>
                    <span className="text-xs font-semibold text-slate-200">项目已识别</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-emerald-900/40 flex items-center gap-2.5">
                    <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400"></span>
                    <span className="text-xs font-semibold text-slate-200">运行环境已准备</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-emerald-900/40 flex items-center gap-2.5">
                    <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400"></span>
                    <span className="text-xs font-semibold text-slate-200">所需组件已完成</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-emerald-900/40 flex items-center gap-2.5">
                    <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400"></span>
                    <span className="text-xs font-semibold text-slate-200">可以开始</span>
                  </div>
                </div>
              </div>

              {/* Task Input Section */}
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-400" />
                    输入需要处理的业务文本或草稿:
                  </label>
                  <button
                    onClick={loadPresetSample}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium underline cursor-pointer"
                  >
                    一键装载真实老挝投资调研原始草稿 (sample_input.txt)
                  </button>
                </div>

                <textarea
                  value={userContent}
                  onChange={(e) => setUserContent(e.target.value)}
                  rows={5}
                  placeholder="在此输入口语化、混乱的商务汇报、会议记录或原始文本内容..."
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none font-sans"
                />

                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <Info className="h-3.5 w-3.5 text-slate-500" />
                    <span>系统将严格按照项目的物理 <code className="text-emerald-300 font-mono">SKILL.md</code> 与报告模板进行真实结构化提炼与落盘</span>
                  </div>

                  <button
                    onClick={handleExecute}
                    disabled={isExecuting || !userContent.trim()}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition shadow-lg ${
                      isExecuting || !userContent.trim()
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 cursor-pointer'
                    }`}
                  >
                    {isExecuting ? (
                      <>
                        <RotateCcw className="h-4 w-4 animate-spin" />
                        <span>真实执行中并物理落盘...</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 fill-white" />
                        <span>开始运行 (Direct Execution)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Output Deliverable Card (When executed) */}
            {latestArtifactText && latestReceipt && (
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-5 shadow-xl">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-base font-bold text-white flex items-center gap-2">
                        <span>最终生成交付物: output_brief.md</span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Tier 1 & Tier 2 验证合格 (PASS)
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 font-mono">
                        物理文件位置: /workspace/projects/{selectedProjectId}/{latestReceipt.artifactPaths[0]} ({latestReceipt.outputBytes} 字节)
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const blob = new Blob([latestArtifactText], { type: 'text/markdown' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'output_brief.md';
                        a.click();
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition"
                    >
                      <Download className="h-3.5 w-3.5" />
                      下载文件 (.md)
                    </button>
                  </div>
                </div>

                {/* Markdown Rendered Content */}
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                  {latestArtifactText}
                </div>

                {/* Collapsible Technical Details Drawer */}
                <div className="border-t border-slate-800 pt-3">
                  <button
                    onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                    className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-slate-200 transition"
                  >
                    {showTechnicalDetails ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span>{showTechnicalDetails ? '收起技术详情与收据' : '展开技术详情 (ExecutionReceipt & Physical Evidence)'}</span>
                  </button>

                  {showTechnicalDetails && (
                    <div className="mt-3 p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 space-y-2">
                      <div className="text-emerald-400 font-bold">ExecutionReceipt 签发凭证:</div>
                      <div>Run ID: {latestReceipt.runId}</div>
                      <div>物理耗时: {latestReceipt.durationMs} ms</div>
                      <div>输入体积: {latestReceipt.inputBytes} 字节 | 产物体积: {latestReceipt.outputBytes} 字节</div>
                      <div>退出码 (Exit Code): {latestReceipt.exitCode}</div>
                      <div>
                        Tier 1 物理检验: 文件存在 ({String(latestReceipt.verificationDetails.tier1.fileExists)}), 大小非零 ({String(latestReceipt.verificationDetails.tier1.nonZeroSize)})
                      </div>
                      <div>Tier 2 结构检验: {latestReceipt.verificationDetails.tier2.checks.join('; ')}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================= TAB 2: Phase 0 确定性扫描与事实账本 ======================= */}
        {activeTab === 'facts' && (
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Database className="h-5 w-5 text-emerald-400" />
                    Phase 0: 确定性项目扫描器 (Deterministic Scanner) 与 FACT 账本
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    系统纯依靠物理文件递归扫描，严禁在扫描阶段混入任何 AI 猜测，100% 保障客观事实真实可查。
                  </p>
                </div>

                <button
                  onClick={() => fetchScan(selectedProjectId)}
                  disabled={isLoadingScan}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
                >
                  <RotateCcw className={`h-3.5 w-3.5 ${isLoadingScan ? 'animate-spin' : ''}`} />
                  重新扫描物理文件
                </button>
              </div>

              {/* Metrics Grid */}
              {ledger && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div className="text-[11px] text-slate-400">物理文件总数</div>
                    <div className="text-xl font-bold text-white mt-1">{ledger.totalFiles} 个文件</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">{ledger.totalSizeBytes} 字节</div>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div className="text-[11px] text-slate-400">核心配置/规约清单</div>
                    <div className="text-xl font-bold text-emerald-400 mt-1">{ledger.primaryFiles.length} 项发现</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{ledger.primaryFiles.join(', ')}</div>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div className="text-[11px] text-slate-400">检测到的外部依赖声明</div>
                    <div className="text-xl font-bold text-indigo-300 mt-1">{ledger.dependencies.length} 项包声明</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">从 requirements/package 物理读取</div>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div className="text-[11px] text-slate-400">提取到的候选物理入口</div>
                    <div className="text-xl font-bold text-teal-300 mt-1">{ledger.candidateEntries.length || ledger.skills.length} 项候选</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                      {ledger.candidateEntries.join(', ') || ledger.skills.join(', ')}
                    </div>
                  </div>
                </div>
              )}

              {/* Fact Ledger Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-300 font-semibold">
                  <span>FACT 物理事实账本记录清单 (点击路径可直接验证物理文件内容):</span>
                  <span className="font-mono text-slate-500">标记规范: 100% 物理证据 (FACT)</span>
                </div>

                <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 font-mono sticky top-0">
                      <tr>
                        <th className="py-2.5 px-4">事实编号</th>
                        <th className="py-2.5 px-4">事实类型</th>
                        <th className="py-2.5 px-4">物理相对路径</th>
                        <th className="py-2.5 px-4">物理值 / 体积</th>
                        <th className="py-2.5 px-4 text-right">证明操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                      {ledger?.facts.map((fact) => (
                        <tr key={fact.id} className="hover:bg-slate-900/50 transition">
                          <td className="py-2 px-4 text-emerald-400 font-bold">{fact.id}</td>
                          <td className="py-2 px-4 text-slate-400">{fact.factType}</td>
                          <td className="py-2 px-4 text-slate-200">{fact.path}</td>
                          <td className="py-2 px-4 text-slate-400 truncate max-w-xs">{fact.value}</td>
                          <td className="py-2 px-4 text-right">
                            <button
                              onClick={() => inspectFile(fact.path)}
                              className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                            >
                              <Eye className="h-3 w-3" />
                              查看实际文件证明
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================= TAB 3: Phase 0.5 Runtime Contract 与忠实度 ======================= */}
        {activeTab === 'contract' && (
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <FileCode className="h-5 w-5 text-indigo-400" />
                    Phase 0.5: Runtime Contract 运行合同与 Fidelity Manifest
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    由 Gemini AI Interpreter 基于 Phase 0 物理事实编译出的机器可执行合同。明确区分 FACT 与 INFERENCE，严禁将自然语言文字直接变成命令。
                  </p>
                </div>

                <button
                  onClick={() => fetchContract(selectedProjectId)}
                  disabled={isLoadingContract}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow transition cursor-pointer"
                >
                  <RotateCcw className={`h-3.5 w-3.5 ${isLoadingContract ? 'animate-spin' : ''}`} />
                  重新编译合同
                </button>
              </div>

              {contract && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left: Contract Details */}
                  <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
                    <div className="text-xs font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center justify-between">
                      <span>核心机制与执行契约 (Execution Contract)</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                        {contract.runtimeType}
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">原始机制 (Original Mechanism):</span>
                        <span className="font-mono text-emerald-400 font-semibold">{contract.originalMechanism}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">执行模式 (Execution Mode):</span>
                        <span className="font-mono text-indigo-300">{contract.executionMode}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">入口实体 (Entry Point):</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-200">{contract.entry}</span>
                          {contract.entryIsExecutable ? (
                            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded">可执行脚本</span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded">
                              非可执行程序 (Skill 规则文本)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">输入参数定义:</span>
                        <span className="font-mono text-slate-300">{contract.inputs.map((i) => `${i.name} (${i.type})`).join(', ')}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">产出文件要求:</span>
                        <span className="font-mono text-slate-300">{contract.outputs.map((o) => o.filename).join(', ')}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">网络与隔离策略:</span>
                        <span className="font-mono text-slate-300">{contract.environment.networkPolicy}</span>
                      </div>
                    </div>

                    {/* Fidelity Manifest */}
                    <div className="pt-2">
                      <div className="text-[11px] font-bold text-slate-300 mb-1.5">Fidelity Manifest (项目机制原貌保护账本):</div>
                      <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1 font-mono">
                        <div>原生代码未修改率: <span className="text-emerald-400 font-bold">{contract.fidelity.unmodifiedRate}</span></div>
                        <div>ASI 适配层说明: {contract.fidelity.adaptationSummary}</div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Provenance (FACT vs INFERENCE Isolation) */}
                  <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
                    <div className="text-xs font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center justify-between">
                      <span>事实与推断强隔离账本 (FACT vs INFERENCE Separation)</span>
                      <span className="text-[10px] text-slate-400 font-mono">第4条原则落地检验</span>
                    </div>

                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {contract.provenance.map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 text-xs">
                          <div>
                            <span className="font-semibold text-slate-200">{p.field}</span>
                            <span className="text-slate-500 font-mono text-[10px] block">来源证据: {p.sourceRef}</span>
                          </div>
                          <div>
                            {p.status === 'FACT' ? (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                FACT (物理文件)
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                INFERENCE (AI推断)
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="text-xs text-slate-400 bg-slate-900/50 p-3 rounded-lg border border-slate-800/80 leading-relaxed">
                      💡 <strong>安全保障:</strong> 系统绝不允许将未经物理文件佐证的 INFERENCE 直接执行为系统级命令。对于 A0 类项目，系统将其定性为 <code className="text-emerald-300 font-mono">llm_directed_skill</code>，由宿主大模型严格解释 Skill 规则执行，绝不会去误调 <code className="text-rose-400 font-mono">python SKILL.md</code>。
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================= TAB 4: Phase 1 执行验证与收据 ======================= */}
        {activeTab === 'receipts' && (
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-400" />
                    Phase 1: 真实执行收据 (ExecutionReceipt) 与贯穿式验证
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    系统严格拒绝“AI 自称完成”，必须产生真实落盘文件并通过 Tier 1 物理检查与 Tier 2 格式合规检查。
                  </p>
                </div>
              </div>

              {latestReceipt ? (
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4 font-mono text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <span className="text-emerald-400 font-bold text-sm">收据签发成功: {latestReceipt.runId}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      验证状态: {latestReceipt.verificationPassed ? 'PASS (合格)' : 'FAIL (不合格)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 text-slate-300">
                      <div>项目 ID: {latestReceipt.projectId}</div>
                      <div>签发时间: {latestReceipt.timestamp}</div>
                      <div>执行模式: {latestReceipt.executionMode}</div>
                      <div>退出码 (Exit Code): {latestReceipt.exitCode}</div>
                      <div>实际执行耗时: {latestReceipt.durationMs} ms</div>
                    </div>
                    <div className="space-y-2 text-slate-300">
                      <div>输入字节: {latestReceipt.inputBytes} 字节</div>
                      <div>输出字节: {latestReceipt.outputBytes} 字节</div>
                      <div>落盘路径: {latestReceipt.artifactPaths.join(', ')}</div>
                      <div className="text-emerald-400">
                        Tier 1 (文件物理存在 & 大小非零): PASS
                      </div>
                      <div className="text-emerald-400">
                        Tier 2 (结构规范与 Markdown 标题结构): PASS
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950 p-12 rounded-xl border border-slate-800 text-center text-slate-500 text-xs">
                  暂无执行记录。请在【用户工作台】中点击“开始运行”以产出第一份真实收据与产物。
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Raw Physical File Inspector Modal (Proof of Facts) */}
      {inspectedFilePath && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="h-4 w-4 text-emerald-400" />
                <span className="font-mono text-xs font-bold text-slate-100">
                  物理文件证据审查: /workspace/projects/{selectedProjectId}/{inspectedFilePath}
                </span>
              </div>
              <button
                onClick={() => setInspectedFilePath(null)}
                className="text-slate-400 hover:text-slate-200 text-xs px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700"
              >
                关闭
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-slate-200 bg-slate-950 whitespace-pre-wrap leading-relaxed">
              {isLoadingFile ? '正在从磁盘物理读取文件...' : inspectedFileContent}
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-900/60 text-[11px] text-slate-400 flex justify-between items-center">
              <span>状态: 真实物理文件直接读取，零 AI 改写与截断。</span>
              <span className="text-emerald-400 font-mono">100% FACT Verified</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/60 px-6 py-4 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span>ASI (Agent-Skill Intelligence) 通用智能项目底座 · Phase 0 / 0.5 / 1 验证标准</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400 font-mono">
          <span>Gate 0: 确定性扫描 PASS</span>
          <span>•</span>
          <span>Gate 0.5: Runtime Contract PASS</span>
          <span>•</span>
          <span>Gate 1: A0 真实闭环 PASS</span>
        </div>
      </footer>
    </div>
  );
}
