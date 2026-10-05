// Optional DEVELOPMENT-ONLY plugin. Install only in a disposable test vault.
// Refuses any vault not named test-vault/test_vault and uses an isolated fixture.
const { Plugin, Notice } = require('obsidian')
const { createHash } = require('crypto')
const hash = value => createHash('sha256').update(value).digest('hex')
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
module.exports = class FolderColorGraphQA extends Plugin {
  onload() {
    this.addCommand({id:'run',name:'Run Folder Color Graph runtime tests',callback:()=>void this.run()})
  }
  async run() {
    if (this.running) return
    if (!/^test[-_]vault$/i.test(this.app.vault.getName())) { new Notice('QA requires a vault named test-vault or test_vault.'); return }
    this.running = true
    const app = this.app, base = 'Folder Color Graph Tests', qa = base + '/Runtime QA'
    const id = 'folder-color-graph', report = {version:app.getVersion?.() ?? '1.13.7',checks:[],errors:[]}
    const p = () => app.plugins.getPlugin(id)
    const original = p() ? JSON.parse(JSON.stringify(p().settings)) : null
    const check = (name, condition) => { report.checks.push({name,passed:!!condition}); if(!condition) throw new Error(name) }
    const until = async (predicate) => { for(let i=0;i<75;i++) {if(predicate()) return; await delay(80)} throw new Error('Timed out waiting for graph update') }
    let leaf, graphSnapshot, notesSnapshot
    try {
      if (!original || app.vault.getAbstractFileByPath(qa)) throw new Error('Plugin missing or QA fixture already exists; no changes made')
      notesSnapshot = new Map(await Promise.all(app.vault.getMarkdownFiles().filter(f=>f.path.startsWith(base+'/')).map(async f=>[f.path,hash(await app.vault.read(f))])))
      leaf = app.workspace.getLeavesOfType('graph')[0] ?? app.workspace.getLeaf('tab')
      if (leaf.view.getViewType() !== 'graph') await leaf.setViewState({type:'graph',active:true})
      await until(()=>Array.isArray(leaf.view.renderer?.nodes))
      await delay(1200)
      const graphFile = app.vault.configDir + '/graph.json'
      graphSnapshot = await app.vault.adapter.exists(graphFile) ? await app.vault.adapter.read(graphFile) : null
      const node = path => leaf.view.renderer.nodes.find(n=>n.id===path)
      const rgb = path => node(path)?.getFillColor().rgb
      const course = base + '/University/VO Introduction to DH', child = course + '/Assignments'
      const lecture = course + '/Lecture 01.md', exercise = child + '/Exercise 01.md'
      await until(()=>node(lecture) && node(exercise))
      check('global blue inheritance', rgb(lecture)===0x4f83cc)
      check('global nested orange override', rgb(exercise)===0xca8135)
      const locals = app.workspace.getLeavesOfType('localgraph')
      check('local graph blue and orange', locals.length>0 && locals.some(l=>l.view.renderer?.nodes.some(n=>n.id===lecture && n.getFillColor().rgb===0x4f83cc) && l.view.renderer.nodes.some(n=>n.id===exercise && n.getFillColor().rgb===0xca8135)))
      await p().assign(app.vault.getAbstractFileByPath(course),'purple')
      check('live color change with open graph', rgb(lecture)===0x9174c6)
      await p().assign(app.vault.getAbstractFileByPath(child),null)
      check('removing child override restores inherited color', rgb(exercise)===0x9174c6)
      await p().assign(app.vault.getAbstractFileByPath(child),'orange')
      await p().assign(app.vault.getAbstractFileByPath(course),'blue')
      const outside = base+'/University/Outside Course'
      await p().assign(app.vault.getAbstractFileByPath(outside),'teal')
      await until(()=>rgb(outside+'.md')===0x389b90)
      check('outside-folder note correspondence',rgb(outside+'.md')===0x389b90)
      // Exercise group precedence using an ephemeral native group-supplied node.color.
      const n=node(lecture), oldColor=n.color
      n.color={rgb:0xabcdef,a:1}
      p().settings.groupPrecedence='native'; await p().saveSettings()
      check('native group precedence',rgb(lecture)===0xabcdef)
      p().settings.groupPrecedence='folder'; await p().saveSettings()
      check('folder color precedence',rgb(lecture)===0x4f83cc)
      n.color=oldColor
      const personal=base+'/Personal/Home.md'
      check('uncolored note retains native fill',rgb(personal)===leaf.view.renderer.colors.fill.rgb)
      await app.vault.createFolder(qa)
      let folder=await app.vault.createFolder(qa+'/Course')
      await app.vault.createFolder(folder.path+'/Child')
      let note=await app.vault.create(folder.path+'/Course.md','# Course\n\n[[QA Child]]\n')
      await app.vault.create(folder.path+'/Child/QA Child.md','# QA Child\n\n[[Course]]\n')
      await p().assign(folder,'blue')
      await p().assign(app.vault.getAbstractFileByPath(folder.path+'/Child'),'orange')
      await until(()=>rgb(note.path)===0x4f83cc)
      check('graph receives newly created notes',rgb(note.path)===0x4f83cc)
      const oldPath=folder.path
      await app.fileManager.renameFile(folder,qa+'/Übungen (2026) # & é')
      await app.fileManager.renameFile(note,folder.path+'/Übungen (2026) # & é.md')
      await until(()=>rgb(note.path)===0x4f83cc)
      check('rename retains folder and child assignments',p().settings.fileColors.some(a=>a.path===folder.path && a.color==='blue') && p().settings.fileColors.some(a=>a.path===folder.path+'/Child' && a.color==='orange') && !p().settings.fileColors.some(a=>a.path===oldPath || a.path.startsWith(oldPath+'/')))
      await app.vault.createFolder(qa+'/Archive')
      await app.fileManager.renameFile(folder,qa+'/Archive/'+folder.name)
      await until(()=>rgb(note.path)===0x4f83cc)
      check('move retains graph inheritance',rgb(folder.path+'/Child/QA Child.md')===0xca8135)
      const fresh=await app.vault.create(folder.path+'/QA New.md','# QA New\n')
      await until(()=>rgb(fresh.path)===0x4f83cc)
      check('new descendant inherits automatically',rgb(fresh.path)===0x4f83cc)
      await app.plugins.disablePlugin(id)
      check('unload restores native graph color',rgb(lecture)!==0x4f83cc)
      await app.plugins.enablePlugin(id)
      await until(()=>rgb(lecture)===0x4f83cc)
      check('reload restores persisted colors',rgb(note.path)===0x4f83cc)
      const deleted=folder.path
      await app.fileManager.trashFile(folder)
      await until(()=>!node(note.path))
      check('delete removes obsolete assignments',!p().settings.fileColors.some(a=>a.path===deleted || a.path.startsWith(deleted+'/')))
      await delay(300)
      const after=await app.vault.adapter.exists(graphFile) ? await app.vault.adapter.read(graphFile) : null
      check('graph.json remains byte-for-byte unchanged',after===graphSnapshot)
      const unchanged=await Promise.all([...notesSnapshot].map(async ([path,before])=>hash(await app.vault.read(app.vault.getAbstractFileByPath(path)))===before))
      check('original fixture Markdown remains unchanged',unchanged.every(Boolean))
    } catch(error) { report.errors.push(String(error)) }
    finally {
      try {
        if(original && p()) {p().settings=original; await p().saveSettings()}
        const fixture=app.vault.getAbstractFileByPath(qa)
        if(fixture && notesSnapshot) await app.fileManager.trashFile(fixture)
      } catch(error) { report.errors.push('Cleanup: '+String(error)) }
      report.passed=report.errors.length===0 && report.checks.length>0 && report.checks.every(c=>c.passed)
      await app.vault.adapter.write(app.vault.configDir+'/plugins/folder-color-graph-qa/result.json',JSON.stringify(report,null,2))
      new Notice(`Folder Color Graph runtime QA: ${report.passed ? 'PASS' : 'FAIL'} (${report.checks.length} checks)`,10000)
      this.running=false
    }
  }
}
