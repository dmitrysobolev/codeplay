"use client";
import { useState, useRef, useEffect } from "react";
import { Highlight, themes } from "prism-react-renderer";

const GITHUB_TOKEN = "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";

function parseRepoUrl(input: string): { owner: string, repo: string } | null {
  const urlPattern = /github\.com\/(.+?)\/(.+?)(?:\.git|\/|$)/i;
  const shortPattern = /^([\w-]+)\/([\w.-]+)$/;
  let match = input.match(urlPattern);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  match = input.match(shortPattern);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  return null;
}

type TreeItem = { path: string; type: string };

async function fetchFiles(owner: string, repo: string, branch: string, token: string): Promise<string[] | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const res = await fetch(url, {
    headers: { Authorization: `token ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const textExts = [
    ".txt", ".md", ".py", ".js", ".json", ".csv", ".html", ".css", ".ts", ".java", ".c", ".cpp", ".xml", ".yml", ".yaml", ".ini", ".cfg", ".log"
  ];
  return (data.tree || [])
    .filter((item: TreeItem) => item.type === "blob" && textExts.some(ext => item.path.endsWith(ext)))
    .map((item: TreeItem) => item.path);
}

async function fetchFileContent(owner: string, repo: string, path: string, branch: string, token: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
  const res = await fetch(url, {
    headers: { Authorization: `token ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.encoding === "base64" && data.content) {
    try {
      return atob(data.content.replace(/\n/g, ""));
    } catch {
      return null;
    }
  }
  return null;
}

// Utility to guess language from file extension
function getLanguageFromFilename(filename: string): Language | undefined {
  if (filename.endsWith(".py")) return "python";
  if (filename.endsWith(".js")) return "javascript";
  if (filename.endsWith(".ts")) return "typescript";
  if (filename.endsWith(".json")) return "json";
  if (filename.endsWith(".html")) return "markup";
  if (filename.endsWith(".css")) return "css";
  if (filename.endsWith(".md")) return "markdown";
  if (filename.endsWith(".java")) return "java";
  if (filename.endsWith(".c")) return "c";
  if (filename.endsWith(".cpp")) return "cpp";
  if (filename.endsWith(".xml")) return "markup";
  if (filename.endsWith(".yml") || filename.endsWith(".yaml")) return "yaml";
  return undefined;
}

export default function Home() {
  const [repoInput, setRepoInput] = useState("");
  const [files, setFiles] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [branchUsed, setBranchUsed] = useState<string | null>(null);
  const [repoInfo, setRepoInfo] = useState<{ owner: string, repo: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const scrollRef = useRef<HTMLPreElement | null>(null);
  const scrollInterval = useRef<NodeJS.Timeout | null>(null);
  const [nextFileCache, setNextFileCache] = useState<{ path: string, content: string } | null>(null);

  // Auto-scroll effect
  useEffect(() => {
    if (!isPlaying || !fileContent) return;
    const el = scrollRef.current;
    if (!el) return;
    const scrollStep = 1; // px per tick
    const scrollDelay = 20; // ms per tick
    function scrollDown() {
      if (!el) return;
      if (el.scrollTop + el.clientHeight < el.scrollHeight) {
        el.scrollTop += scrollStep;
      } else {
        // End of file, go to next file if available
        setIsPlaying(false);
        if (files && selectedFile) {
          const idx = files.indexOf(selectedFile);
          if (idx !== -1 && idx + 1 < files.length) {
            setTimeout(() => {
              handleSelectFile(files[idx + 1], true, true);
            }, 500);
          }
        }
      }
    }
    scrollInterval.current = setInterval(scrollDown, scrollDelay);
    return () => {
      if (scrollInterval.current) clearInterval(scrollInterval.current);
    };
    // Only depend on isPlaying, fileContent, files, selectedFile
  }, [isPlaying, fileContent, files, selectedFile]);

  // Reset scroll on new file
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [fileContent]);

  // Preload next file content
  useEffect(() => {
    if (!files || !selectedFile || !repoInfo || !branchUsed) {
      setNextFileCache(null);
      return;
    }
    const idx = files.indexOf(selectedFile);
    if (idx === -1 || idx + 1 >= files.length) {
      setNextFileCache(null);
      return;
    }
    const nextPath = files[idx + 1];
    let cancelled = false;
    fetchFileContent(repoInfo.owner, repoInfo.repo, nextPath, branchUsed, GITHUB_TOKEN).then(content => {
      if (!cancelled && content !== null) {
        setNextFileCache({ path: nextPath, content });
      }
    });
    return () => { cancelled = true; };
  }, [files, selectedFile, repoInfo, branchUsed]);

  const handleFetchFiles = async () => {
    setError(null);
    setFiles(null);
    setSelectedFile(null);
    setFileContent(null);
    setFileError(null);
    setBranchUsed(null);
    setNextFileCache(null);
    const info = parseRepoUrl(repoInput.trim());
    if (!info) {
      setError("Invalid repo URL or format. Use https://github.com/owner/repo or owner/repo.");
      return;
    }
    setRepoInfo(info);
    setLoading(true);
    // Try master, then main
    let fileList = await fetchFiles(info.owner, info.repo, "master", GITHUB_TOKEN);
    let branch = "master";
    if (!fileList) {
      fileList = await fetchFiles(info.owner, info.repo, "main", GITHUB_TOKEN);
      branch = "main";
    }
    setLoading(false);
    if (!fileList) {
      setError("Could not fetch files. Check repo and token.");
      return;
    }
    setFiles(fileList);
    setBranchUsed(branch);
    // Auto-select and play the first file if available
    if (fileList.length > 0) {
      handleSelectFile(fileList[0], true);
    }
  };

  // If useCache is true and the next file is cached, use it
  const handleSelectFile = async (file: string, autoPlay = false, useCache = false) => {
    if (!repoInfo || !branchUsed) return;
    setSelectedFile(file);
    setFileContent(null);
    setFileError(null);
    setFileLoading(true);
    setIsPlaying(autoPlay);
    if (useCache && nextFileCache && nextFileCache.path === file) {
      setFileContent(nextFileCache.content);
      setFileLoading(false);
      return;
    }
    const content = await fetchFileContent(repoInfo.owner, repoInfo.repo, file, branchUsed, GITHUB_TOKEN);
    setFileLoading(false);
    if (content === null) {
      setFileError("Could not fetch file content.");
      setIsPlaying(false);
      return;
    }
    setFileContent(content);
  };

  // Keyboard accessibility for file list
  const handleFileKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, file: string) => {
    if (e.key === "Enter" || e.key === " ") {
      handleSelectFile(file);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-8 gap-8 bg-black">
      <h1 className="text-3xl font-bold mb-4 text-white">CodePlay: GitHub File Browser</h1>
      <div className="flex flex-col gap-2 w-full max-w-5xl">
        <label htmlFor="repo" className="font-semibold text-white">GitHub Repo URL or owner/repo:</label>
        <input
          id="repo"
          type="text"
          className="border rounded px-3 py-2 text-lg bg-zinc-900 text-white placeholder-gray-400 border-zinc-700"
          placeholder="https://github.com/tinygrad/tinygrad or tinygrad/tinygrad"
          value={repoInput}
          onChange={e => setRepoInput(e.target.value)}
        />
        <button
          type="button"
          className="bg-blue-600 text-white px-4 py-2 rounded mt-2 hover:bg-blue-700 disabled:opacity-50"
          onClick={handleFetchFiles}
          disabled={loading || !repoInput.trim()}
        >
          {loading ? "Loading..." : "Fetch Files"}
        </button>
        {error && <div className="text-red-400 mt-2">{error}</div>}
      </div>
      <div className="flex flex-1 w-full max-w-5xl gap-8 mt-4 flex-col md:flex-row">
        {/* File tree/list on the left */}
        <div className="md:w-1/3 w-full bg-zinc-900 border border-zinc-700 rounded-lg shadow p-4 max-h-[70vh] overflow-y-auto">
          <h2 className="text-xl font-semibold mb-2 text-white">Text Files</h2>
          {files ? (
            <ul className="list-disc pl-6">
              {files.map(f => (
                <li key={f} className="break-all">
                  <button
                    type="button"
                    className={`text-blue-400 hover:underline cursor-pointer bg-transparent border-none p-0 m-0 text-left ${selectedFile === f ? "font-bold text-blue-200" : ""}`}
                    onClick={() => handleSelectFile(f)}
                    onKeyDown={e => handleFileKeyDown(e, f)}
                    aria-pressed={selectedFile === f}
                  >
                    {f}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="italic text-gray-400">No files loaded.</div>
          )}
        </div>
        {/* Play window on the right */}
        <div className="md:w-2/3 w-full border border-zinc-700 rounded-lg shadow bg-zinc-900 p-4 flex flex-col min-h-[300px]">
          <h3 className="text-lg font-semibold mb-2 text-white">Now Playing</h3>
          <div className="flex items-center gap-4 mb-2">
            <span className="font-mono text-sm text-gray-300 flex-1">
              {selectedFile ? selectedFile : <span className="italic text-gray-500">No file selected</span>}
            </span>
            <button
              type="button"
              className={`px-3 py-1 rounded ${isPlaying ? "bg-red-500" : "bg-green-600"} text-white`}
              onClick={() => setIsPlaying(p => !p)}
              disabled={!selectedFile || fileLoading || !!fileError}
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
          </div>
          <div className="flex-1 min-h-[200px] max-h-[60vh] overflow-y-auto">
            {fileLoading && selectedFile && <div className="text-gray-300">Loading file...</div>}
            {fileError && selectedFile && <div className="text-red-400">{fileError}</div>}
            {fileContent && selectedFile && (
              <Highlight
                code={fileContent}
                language={getLanguageFromFilename(selectedFile) || "text"}
                theme={themes.shadesOfPurple}
              >
                {({ className, style, tokens, getLineProps, getTokenProps }: {
                  className: string;
                  style: React.CSSProperties;
                  tokens: any[][];
                  getLineProps: (props: any) => any;
                  getTokenProps: (props: any) => any;
                }) => (
                  <pre
                    ref={scrollRef}
                    className={`rounded p-4 whitespace-pre-wrap text-sm transition-all text-gray-100 max-h-[60vh] overflow-y-auto ${className}`}
                    style={style}
                  >
                    {tokens.map((line, i) => (
                      <div key={i} {...getLineProps({ line, key: i })}>
                        {line.map((token, key) => (
                          <span key={key} {...getTokenProps({ token, key })} />
                        ))}
                      </div>
                    ))}
                  </pre>
                )}
              </Highlight>
            )}
            {!selectedFile && <div className="italic text-gray-500">Select a file to start playing.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
