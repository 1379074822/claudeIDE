/**
 * Complete tool definitions from Claude Code
 * Based on open-claude-code/src/tools/
 */

export const CLAUDE_TOOLS = [
  // File operations
  {
    name: 'read_file',
    description: 'Read the complete contents of a file from the file system. Handles various text encodings and provides detailed error messages if the file cannot be read. Use this tool when you need to examine the contents of a single file.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'The path of the file to read (relative to the current working directory)',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file at the specified path. If the file exists, it will be overwritten. If the file does not exist, it will be created. Always provide the complete intended content of the file.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'The path where the file should be written',
        },
        content: {
          type: 'string',
          description: 'The complete content to write to the file',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: 'Make line-based edits to a text file. Provide the exact lines to search for and their replacements.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Path to the file' },
        edits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              oldText: { type: 'string', description: 'Text to find (must match exactly)' },
              newText: { type: 'string', description: 'Text to replace with' },
            },
            required: ['oldText', 'newText'],
          },
        },
        dryRun: { type: 'boolean', description: 'Preview changes without applying' },
      },
      required: ['path', 'edits'],
    },
  },

  // Directory operations
  {
    name: 'list_files',
    description: 'List all files and directories in the specified path. Shows file names, types (file/directory), and sizes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to list (defaults to current directory)',
        },
      },
    },
  },

  // Search operations
  {
    name: 'glob',
    description: 'Search for files matching a glob pattern. Supports wildcards like *.js, **/*.ts, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern (e.g., "**/*.ts", "src/**/*.js")',
        },
        path: {
          type: 'string',
          description: 'Base directory to search in',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'grep',
    description: 'Search for text patterns in files using ripgrep. Supports regex patterns and various output modes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: {
          type: 'string',
          description: 'Text or regex pattern to search for',
        },
        path: {
          type: 'string',
          description: 'Directory or file to search in',
        },
        filePattern: {
          type: 'string',
          description: 'Glob pattern to filter files (e.g., "*.js")',
        },
        caseSensitive: {
          type: 'boolean',
          description: 'Whether search is case sensitive',
        },
      },
      required: ['pattern'],
    },
  },

  // Command execution
  {
    name: 'execute_command',
    description: 'Execute a shell command and return its output. Use this for running build scripts, tests, git commands, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: {
          type: 'string',
          description: 'The command to execute',
        },
        workingDir: {
          type: 'string',
          description: 'Working directory for the command',
        },
      },
      required: ['command'],
    },
  },

  // Web operations
  {
    name: 'web_search',
    description: 'Search the web for information. Returns search results with titles, URLs, and snippets.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'fetch_url',
    description: 'Fetch content from a URL. Useful for reading documentation, API responses, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'URL to fetch',
        },
      },
      required: ['url'],
    },
  },

  // User interaction
  {
    name: 'ask_user',
    description: 'Ask the user a question and wait for their response. Use this when you need clarification or user input.',
    input_schema: {
      type: 'object' as const,
      properties: {
        question: {
          type: 'string',
          description: 'The question to ask the user',
        },
      },
      required: ['question'],
    },
  },
]
