/**
 * ConfigManager - Configuration file I/O for Claude Code settings
 *
 * Handles reading/writing of:
 * - ~/.claude/settings.json (global settings)
 * - <project>/.claude/settings.json (project settings)
 * - CLAUDE.md (global and project-level)
 * - .mcp.json (MCP server configs)
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

class ConfigManager {
  constructor() {
    this._claudeHome = path.join(os.homedir(), '.claude')
  }

  // ============================================================
  // Settings.json
  // ============================================================

  /**
   * Read global settings from ~/.claude/settings.json
   * @returns {{success: boolean, data?: object, error?: string}}
   */
  readGlobalSettings() {
    return this._readJsonFile(path.join(this._claudeHome, 'settings.json'))
  }

  /**
   * Write global settings
   * @param {object} data
   */
  writeGlobalSettings(data) {
    return this._writeJsonFile(path.join(this._claudeHome, 'settings.json'), data)
  }

  /**
   * Read project-level settings
   * @param {string} projectRoot
   */
  readProjectSettings(projectRoot) {
    return this._readJsonFile(path.join(projectRoot, '.claude', 'settings.json'))
  }

  /**
   * Write project-level settings
   * @param {string} projectRoot
   * @param {object} data
   */
  writeProjectSettings(projectRoot, data) {
    return this._writeJsonFile(path.join(projectRoot, '.claude', 'settings.json'), data)
  }

  /**
   * Read merged settings (global + project), project overrides global
   * @param {string} [projectRoot]
   */
  readMergedSettings(projectRoot) {
    const global = this.readGlobalSettings()
    const globalData = global.success ? global.data : {}

    if (!projectRoot) {
      return { success: true, data: globalData }
    }

    const project = this.readProjectSettings(projectRoot)
    const projectData = project.success ? project.data : {}

    // Deep merge: project overrides global
    const merged = this._deepMerge(globalData, projectData)
    return { success: true, data: merged }
  }

  // ============================================================
  // CLAUDE.md
  // ============================================================

  /**
   * Read global CLAUDE.md
   */
  readGlobalClaudeMd() {
    return this._readTextFile(path.join(this._claudeHome, 'CLAUDE.md'))
  }

  /**
   * Write global CLAUDE.md
   * @param {string} content
   */
  writeGlobalClaudeMd(content) {
    return this._writeTextFile(path.join(this._claudeHome, 'CLAUDE.md'), content)
  }

  /**
   * Read project CLAUDE.md
   * @param {string} projectRoot
   */
  readProjectClaudeMd(projectRoot) {
    return this._readTextFile(path.join(projectRoot, 'CLAUDE.md'))
  }

  /**
   * Write project CLAUDE.md
   * @param {string} projectRoot
   * @param {string} content
   */
  writeProjectClaudeMd(projectRoot, content) {
    return this._writeTextFile(path.join(projectRoot, 'CLAUDE.md'), content)
  }

  // ============================================================
  // MCP Configuration (.mcp.json)
  // ============================================================

  /**
   * Read global MCP config from ~/.claude/.mcp.json
   */
  readGlobalMcpConfig() {
    return this._readJsonFile(path.join(this._claudeHome, '.mcp.json'))
  }

  /**
   * Write global MCP config
   * @param {object} data
   */
  writeGlobalMcpConfig(data) {
    return this._writeJsonFile(path.join(this._claudeHome, '.mcp.json'), data)
  }

  /**
   * Read project MCP config from <project>/.mcp.json
   * @param {string} projectRoot
   */
  readProjectMcpConfig(projectRoot) {
    return this._readJsonFile(path.join(projectRoot, '.mcp.json'))
  }

  /**
   * Write project MCP config
   * @param {string} projectRoot
   * @param {object} data
   */
  writeProjectMcpConfig(projectRoot, data) {
    return this._writeJsonFile(path.join(projectRoot, '.mcp.json'), data)
  }

  /**
   * Read merged MCP config (global + project)
   * @param {string} [projectRoot]
   */
  readMergedMcpConfig(projectRoot) {
    const global = this.readGlobalMcpConfig()
    const globalServers = global.success ? (global.data.mcpServers || {}) : {}

    if (!projectRoot) {
      return { success: true, data: { mcpServers: globalServers } }
    }

    const project = this.readProjectMcpConfig(projectRoot)
    const projectServers = project.success ? (project.data.mcpServers || {}) : {}

    // Merge: project servers override global servers with same name
    const merged = { ...globalServers, ...projectServers }
    return { success: true, data: { mcpServers: merged } }
  }

  // ============================================================
  // Hooks (within settings.json)
  // ============================================================

  /**
   * Read hooks from global settings
   */
  readGlobalHooks() {
    const settings = this.readGlobalSettings()
    if (!settings.success) return { success: true, data: {} }
    return { success: true, data: settings.data.hooks || {} }
  }

  /**
   * Write hooks to global settings (merge with existing)
   * @param {object} hooks
   */
  writeGlobalHooks(hooks) {
    const settings = this.readGlobalSettings()
    const current = settings.success ? settings.data : {}
    current.hooks = hooks
    return this.writeGlobalSettings(current)
  }

  /**
   * Read hooks from project settings
   * @param {string} projectRoot
   */
  readProjectHooks(projectRoot) {
    const settings = this.readProjectSettings(projectRoot)
    if (!settings.success) return { success: true, data: {} }
    return { success: true, data: settings.data.hooks || {} }
  }

  /**
   * Write hooks to project settings
   * @param {string} projectRoot
   * @param {object} hooks
   */
  writeProjectHooks(projectRoot, hooks) {
    const settings = this.readProjectSettings(projectRoot)
    const current = settings.success ? settings.data : {}
    current.hooks = hooks
    return this.writeProjectSettings(projectRoot, current)
  }

  // ============================================================
  // Recent Projects (IDE-specific, stored in ~/.claude-ide/)
  // ============================================================

  /**
   * Get IDE data directory
   */
  getIdeDataDir() {
    const dir = path.join(os.homedir(), '.claude-ide')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  /**
   * Read recent projects list
   * @returns {{success: boolean, data?: Array<{path: string, name: string, lastOpened: number}>}}
   */
  readRecentProjects() {
    return this._readJsonFile(path.join(this.getIdeDataDir(), 'recent-projects.json'))
  }

  /**
   * Add/update a project in recent list
   * @param {string} projectPath
   */
  addRecentProject(projectPath) {
    const result = this.readRecentProjects()
    const projects = result.success && Array.isArray(result.data) ? result.data : []

    // Remove existing entry for this path
    const filtered = projects.filter(p => p.path !== projectPath)

    // Add to front
    filtered.unshift({
      path: projectPath,
      name: path.basename(projectPath),
      lastOpened: Date.now(),
    })

    // Keep only 20 most recent
    const trimmed = filtered.slice(0, 20)

    return this._writeJsonFile(
      path.join(this.getIdeDataDir(), 'recent-projects.json'),
      trimmed,
    )
  }

  /**
   * Remove a project from recent list
   * @param {string} projectPath
   */
  removeRecentProject(projectPath) {
    const result = this.readRecentProjects()
    const projects = result.success && Array.isArray(result.data) ? result.data : []
    const filtered = projects.filter(p => p.path !== projectPath)
    return this._writeJsonFile(
      path.join(this.getIdeDataDir(), 'recent-projects.json'),
      filtered,
    )
  }

  // ============================================================
  // Private helpers
  // ============================================================

  _readJsonFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: true, data: {} }
      }
      const content = fs.readFileSync(filePath, 'utf-8')
      return { success: true, data: JSON.parse(content) }
    } catch (err) {
      return { success: false, error: `Failed to read ${filePath}: ${err.message}` }
    }
  }

  _writeJsonFile(filePath, data) {
    try {
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
      return { success: true }
    } catch (err) {
      return { success: false, error: `Failed to write ${filePath}: ${err.message}` }
    }
  }

  _readTextFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: true, data: '' }
      }
      const content = fs.readFileSync(filePath, 'utf-8')
      return { success: true, data: content }
    } catch (err) {
      return { success: false, error: `Failed to read ${filePath}: ${err.message}` }
    }
  }

  _writeTextFile(filePath, content) {
    try {
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(filePath, content, 'utf-8')
      return { success: true }
    } catch (err) {
      return { success: false, error: `Failed to write ${filePath}: ${err.message}` }
    }
  }

  _deepMerge(target, source) {
    const result = { ...target }
    for (const key of Object.keys(source)) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        target[key] &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key])
      ) {
        result[key] = this._deepMerge(target[key], source[key])
      } else {
        result[key] = source[key]
      }
    }
    return result
  }
}

module.exports = { ConfigManager }
