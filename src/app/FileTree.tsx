import React, { useState, useEffect } from "react";

type FileNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[] | { [key: string]: FileNode };
};

type FileTreeProps = {
  nodes: FileNode[];
  selectedFile: string | null;
  onSelect: (file: string) => void;
};

function FileTree({ nodes, selectedFile, onSelect }: FileTreeProps) {
  const [openFolders, setOpenFolders] = useState<{ [path: string]: boolean }>({});

  // Helper to collect all folder paths recursively
  function collectFolderPaths(nodes: FileNode[], acc: Set<string>) {
    for (const node of nodes) {
      if (node.type === "folder") {
        acc.add(node.path);
        if (Array.isArray(node.children)) {
          collectFolderPaths(node.children, acc);
        }
      }
    }
  }

  // Expand all folders by default when nodes change
  useEffect(() => {
    const allFolders = new Set<string>();
    collectFolderPaths(nodes, allFolders);
    setOpenFolders(Object.fromEntries(Array.from(allFolders).map(path => [path, true])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  const toggleFolder = (path: string) => {
    setOpenFolders(prev => ({ ...prev, [path]: !prev[path] }));
  };

  return (
    <ul className="pl-4">
      {nodes
        .slice()
        .sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === 'folder' ? -1 : 1;
        })
        .map(node => (
          <li key={node.path} className="break-all">
            {node.type === "folder" ? (
              <div>
                <button
                  type="button"
                  className="text-blue-400 font-bold bg-transparent border-none cursor-pointer mr-1"
                  onClick={() => toggleFolder(node.path)}
                  aria-label={openFolders[node.path] ? "Collapse folder" : "Expand folder"}
                >
                  {openFolders[node.path] ? "▼" : "▶"}
                </button>
                <span className="text-blue-400 font-bold">{node.name}</span>
                {openFolders[node.path] && node.children && (
                  <FileTree nodes={node.children as FileNode[]} selectedFile={selectedFile} onSelect={onSelect} />
                )}
              </div>
            ) : (
              <button
                type="button"
                className={`text-blue-200 hover:underline cursor-pointer bg-transparent border-none p-0 m-0 text-left ${selectedFile === node.path ? "text-green-400" : ""}`}
                onClick={() => onSelect(node.path)}
                aria-pressed={selectedFile === node.path}
              >
                {node.name}
              </button>
            )}
          </li>
        ))}
    </ul>
  );
}

export type { FileNode };
export default FileTree; 