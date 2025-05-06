<template>
  <div class="update page-content f-col f-grow">
    <plugin-disconnected v-if="!connected" class="my-auto"/>
    <error-message
      v-else-if="$ws.pluginUpdateRequired"
      class="my-auto"
      title="Warning"
      color="orange"
    >
      Your version of the QGIS plugin is no longer supported.<br/>
      Please update the Gisquick plugin in order to continue.
    </error-message>
    <template v-else-if="projectInfo">
      <v-dialog v-model="showMetadata">
        <div xv-if="diffs.raw2" class="metadata-view f-col">
          <div class="toolbar dark f-row-ac px-2">
            <span class="title">Gisquick Metadata</span>
            <div class="f-grow"/>
            <v-checkbox
              v-if="diffs.raw2"
              class="filter p-2 m-0 shadow-1"
              label="Only changes"
              v-model="showMetadataDiff"
            />
            <v-btn class="icon" @click="showMetadata = false">
              <v-icon name="x"/>
            </v-btn>
          </div>
          <json-viewer :data="showMetadataDiff && diffs.raw2 ? diffs.raw2 : projectInfo"/>
        </div>
      </v-dialog>

      <div class="mode f-row-ac" :class="updateMode">
        <div class="f-col">
          <span class="title f-grow uppercase">Mode Actualització</span>
          <span class="description">Choose between push and pull operation</span>
        </div>
        <span class="f-grow"/>
        <div class="f-col px-2">
          <span class="label text-right">QGIS Project</span>
          <span v-text="currentProjectFile"/>
        </div>
        <client-svg/>
        <div class="f-col mx-4">
          <arrow-svg width="80" class="arrow mt-2"/>
          <v-btn
            color="primary"
            class="small outlined round"
            @click="toggleMode"
          >
            {{ updateMode }}
          </v-btn>
        </div>
        <server-svg/>
        <div class="f-col px-2">
          <span class="label">Gisquick Project</span>
          <span v-text="project.name"/>
        </div>
        <!-- <span class="f-grow"/> -->
      </div>

      <template v-if="currentProjectFile !== lastProjectFile">
        <div class="warning f-row-ac">
          <v-icon name="warning" class="mr-2"/>
          <span>Project file doesn't match. Make sure you are updating the correct project.</span>
        </div>
        <small class="warning-detail text-center">Last time the project was updated from <strong>{{ lastProjectFile }}</strong> file</small>
        <hr class="mb-1"/>
      </template>
      <hr v-else/>

      <template v-if="isPushMode">
        <div xv-if="diffs.raw2" class="card f-col">
          <div class="header f-row-ac dark">
            <span class="title">Project changes</span>
            <span class="f-grow"/>
            <!-- <a class="link-btn" @click="showMetadata = true">
              <span>Show Gisquick metadata</span>
            </a> -->
            <v-btn
              class="toggle icon"
              :class="{flip: showProjectChanges}"
              @click="showProjectChanges = !showProjectChanges"
            >
              <v-icon name="arrow-down" size="18"/>
            </v-btn>
          </div>
          <v-collapsible v-if="diffs.raw2">
            <div v-show="showProjectChanges" class="f-col">
              <qgis-layers-info :meta="projectInfo2" :classes="diffLayersClasses"/>
              <layers-errors class="my-2" :errors="layersErrors" :project-info="projectInfo"/>
              <div v-if="wfsNotEnabled" class="note mt-2 f-row-ac">
                <v-icon name="circle-i-outline"/>
                <span class="m-2">Vector layers without WFS service enabled cannot be queryable.</span>
                <v-btn class="small" color="orange" @click="enableWFS">Enable WFS</v-btn>
              </div>
            </div>
          </v-collapsible>
          <div v-else class="f-row p-4 mx-auto">
            <v-icon name="circle-i-outline" class="mr-2"/>
            <span v-if="project.meta.project_hash !== projectInfo.project_hash">No Gisquick-related changes were detected in the QGIS project</span>
            <span v-else>QGIS project was not changed</span>
          </div>
        </div>

        <div class="f-row-ac">
          <v-checkbox
            v-if="diffs.raw2 || project.meta.project_hash !== projectInfo.project_hash"
            label="Update QGIS project"
            :disabled="!!layersErrors"
            v-model="updateOpts.qgisProject"
            @input="updateFilesSelection"
          />
          <div class="f-grow"/>
          <a class="link-btn px-2 mx-2" @click="showMetadata = true">
            <small>Show Gisquick metadata</small>
          </a>
        </div>
      </template>

      <div class="card f-col">
        <div class="header f-row-ac dark">
          <span class="title">Files</span>
          <span class="f-grow"/>
          <v-checkbox label="Split view" v-model="splitFilesMode"/>
          <v-menu
            v-if="tasks.clientFiles.data"
            transition="slide-y"
            align="rr;bb,tt"
            content-class="popup-menu"
            :items="reloadMenu"
          >
            <template v-slot:activator="{ toggle }">
              <v-btn class="icon" :loading="tasks.clientFiles.pending || project.files.pending" @click="toggle">
                <v-icon name="reload"/>
              </v-btn>
            </template>
          </v-menu>
        </div>
        <template v-if="clientDirtyFiles || serverDirtyFiles">
          <div class="error-box f-row p-2">
            <v-icon color="red" name="warning" class="mr-2"/>
            <p>
              <span>Project contains temporary files with unsaved changes.</span>
              <span v-if="clientDirtyFiles">
                On the client side, you will need to reopen your QGIS project.
              </span>
              <span v-if="serverDirtyFiles">
                On the server side, you will need to
                <v-btn color="primary" class="inline n-case round outlined small m-0" @click="reloadQgisProject">Reload QGIS project</v-btn>
                and wait a few seconds before refreshing project files.
              </span>
            </p>
          </div>
          <hr/>
        </template>

        <v-btn
          v-if="!clientFiles || !serverFiles"
          class="load my-4"
          color="primary"
          :loading="tasks.clientFiles.pending"
          @click="fetchFiles"
        >
          Load Files
        </v-btn>

        <div class="files-grid" :class="[{split: splitFilesMode}, updateMode]">
          <div v-if="filesDiff" class="f-col target">
            <div class="label" v-text="isPushMode ? 'Server' : 'Client'"/>
            <files-tree
              :files="filesDiff.files"
              :flags="filesDiff.flags"
              :progress="uploadProgress && uploadProgress.files"
              :selected="filesUpdateOpt === 'selected' ? selectedFiles : null"
              :disabled="isFileDisabled"
            >
              <template v-slot:folder-badge="{ folder }">
                <folder-badge class="f-row" v-bind="folder.info"/>
              </template>
              <template v-if="targetDirtyFiles" v-slot:file-badge="{ file }">
                <v-icon
                  v-if="targetDirtyFiles.includes(file.path)"
                  class="file-badge"
                  name="warning"
                  color="red"
                  size="15"
                />
              </template>
            </files-tree>
          </div>
          <div v-if="splitFilesMode && filesDiff" class="f-col source">
            <div class="label" v-text="isPushMode ? 'Client' : 'Server'"/>
            <files-tree :files="isPushMode ? clientFiles : serverFiles">
              <template v-if="sourceDirtyFiles" v-slot:file-badge="{ file }">
                <v-icon
                  v-if="sourceDirtyFiles.includes(file.path)"
                  class="file-badge"
                  name="warning"
                  color="red"
                  size="15"
                />
              </template>
            </files-tree>
          </div>
        </div>
        <template v-if="filesDiff">
          <hr/>
          <div class="statusbar px-2 py-1">
            <span class="new">New files: {{ filesDiff.new.length }}</span>
            <span class="changed">Modified files: {{ filesDiff.updated.length }}</span>
            <span class="removed">Missing files: {{ filesDiff.removed.length }}</span>
          </div>
        </template>
      </div>
      <div class="update-card f-col xshadow-2">
        <div v-if="projectChangesDetected" class="content f-col">
          <!-- <v-checkbox
            v-if="isPushMode && (diffs.raw2 || project.meta.project_hash !== projectInfo.project_hash)"
            label="Update QGIS project"
            :disabled="!!layersErrors"
            v-model="updateOpts.qgisProject"
            @input="updateFilesSelection"
          /> -->
          <div class="f-row f-align-start">
            <v-checkbox
              label="Update files"
              :disabled="!filesDiff"
              v-model="updateOpts.files"
              @input="filesUpdateOpt = $event ? 'new_and_changed' : ''"
            />
            <div class="f-grow"/>
            <div class="files-options px-2 f-row f-align-start">
              <div class="f-col mx-2">
                <v-radio-btn
                  label="New/Modified"
                  :disabled="!updateOpts.files"
                  val="new_and_changed"
                  v-model="filesUpdateOpt"
                />
                <span
                  class="description"
                  v-text="isPushMode ? 'Upload all new and modified files to the server' : 'Download all new and modified files from the server'"
                />
              </div>
              <div class="f-col mx-2">
                <v-radio-btn
                  label="All"
                  :disabled="!updateOpts.files"
                  val="all"
                  v-model="filesUpdateOpt"
                />
                <span
                  class="description"
                  v-text="isPushMode ? 'Upload all new and modified files, removes all missing files' : 'Download all new and modified files, removes all missing files'"
                />
              </div>
              <div class="f-col mx-2">
                <v-radio-btn
                  label="Selected"
                  :disabled="!updateOpts.files"
                  val="selected"
                  v-model="filesUpdateOpt"
                  @input="updateFilesSelection"
                />
                <span class="description"></span>
                <span
                  class="description"
                  v-text="isPushMode ? 'Select files to upload or delete' : 'Select files to download or delete'"
                />
              </div>
            </div>
          </div>
        </div>

      </div>
      <!-- <hr/> -->
      <div class="action f-col-ac my-2">
        <v-btn
          v-if="isPushMode"
          class="round"
          color="primary"
          :disabled="!updateOpts.qgisProject && !updateOpts.files"
          :loading="!!uploadProgress"
          @click="pushChanges"
        >
          <v-icon name="upload" class="mr-2"/>
          <span>Push Changes</span>
        </v-btn>
        <v-btn
          v-else
          class="round"
          color="primary"
          :disabled="!updateOpts.files"
          @click="pullChanges"
        >
          <v-icon name="cloud-download" class="mr-2"/>
          <span>Pull Changes</span>
        </v-btn>
      </div>
    </template>
    <template v-else-if="pluginError">
      <error-message
        v-if="pluginError.code === 404"
        class="my-auto"
        title="Warning"
        color="primary"
      >
        No project is currently opened in QGIS
      </error-message>
      <div v-else class="plugin-error f-col p-2">
        <div class="title f-row-ac my-2">
          <v-icon name="warning" color="red"/>
          <span class="mx-2">Error:</span>
          <span v-text="pluginError.msg"/>
        </div>
        <div v-if="pluginError.details" v-text="pluginError.details" class="traceback"/>
      </div>
    </template>
  </div>
</template>

<script>
import path from 'path'
import omit from 'lodash/omit'
import isEqual from 'lodash/isEqual'
import isEmpty from 'lodash/isEmpty'
import difference from 'lodash/difference'
import keyBy from 'lodash/keyBy'
import cloneDeep from 'lodash/cloneDeep'

// import JsonViewer from '@/components/JsonViewer2.vue'
import JsonViewer from '@/components/JsonDiffViewer.vue'
import FilesTree from '@/components/FilesTree.vue'
import QgisLayersInfo from '@/components/QgisLayersInfo.vue'
import PluginDisconnected from '@/components/PluginDisconnected.vue'
import ErrorMessage from '@/components/ErrorMessage.vue'
import LayersErrors, { layersErrors } from '@/components/LayersErrors.vue'
import FolderBadge from '@/components/FolderBadge.vue'
import ClientSvg from '@/assets/client.svg?component'
import ServerSvg from '@/assets/server.svg?component'
import ArrowSvg from '@/assets/arrow.svg?component'

// import { initLayersPermissions } from '@/views/ProjectAccess.vue'
import { objDiff, objectDiff } from '@/utils/diff'
import { filesDiff, findDirtyFiles } from '@/utils/files'
import { TaskState, watchTask } from '@/tasks'
import { createUpload } from '@/upload'


function findLayer (items, id) {
  for (const item of items) {
    if (item.layers) {
      const match = findLayer(item.layers, id)
      if (match) {
        return [item.name, ...match]
      }
    } else if (item.id === id) {
      return [id]
    }
  }
}
function insertLayer (tree, path) {
  if (path.length === 1) {
    tree.push({ id: path[0] })
  } else if (path.length > 1) {
    const [name, ...rest] = path
    const g = tree.find(i => i.name === name)
    if (g) {
      insertLayer(g.layers, rest)
    } else {
      const newGroup = { name, layers: [] }
      tree.push(newGroup)
      insertLayer(newGroup.layers, rest)
    }
  }
}

export default {
  name: 'ProjectUpdate',
  components: {
    JsonViewer, FilesTree, QgisLayersInfo, PluginDisconnected, ErrorMessage, LayersErrors, FolderBadge,
    ClientSvg, ServerSvg, ArrowSvg
  },
  inject: ['fetchProjectInfo'],
  props: {
    project: Object,
    settings: Object
  },
  data () {
    return {
      pluginError: null,
      projectInfo: null,
      opened: [],
      selectedFiles: [],
      updateOpts: {
        qgisProject: true,
        files: false
      },
      tasks: {
        clientFiles: TaskState()
      },
      uploadProgress: null,
      showMetadata: false,
      showMetadataDiff: true,
      splitFilesMode: false,
      filesUpdateOpt: '', // 'new_and_changed', 'all', 'selected'
      fetchStatus: null,
      updateMode: 'push',
      showProjectChanges: true
    }
  },
  computed: {
    reloadMenu () {
      return [
        { text: 'Client Files', action: this.fetchLocalFiles },
        { text: 'Server Files', action: this.fetchServerFiles },
      ]
    },
    isPushMode () {
      return this.updateMode === 'push'
    },
    connected () {
      return this.$ws.pluginConnected
    },
    clientFiles () {
      const files = this.tasks.clientFiles.data?.files
      return files?.filter(f => !f.path.startsWith('.gisquick/'))
    },
    serverFiles () {
      return this.project.files.data?.files
    },
    clientFilesMap () {
      return keyBy(this.clientFiles, 'path')
    },
    serverFilesMap () {
      return keyBy(this.serverFiles, 'path')
    },
    filesDiff () {
      if (this.clientFiles && this.serverFiles) {
        const server = { list: this.serverFiles, map: this.serverFilesMap }
        const client = { list: this.clientFiles, map: this.clientFilesMap }
        return this.isPushMode ? filesDiff(server, client) : filesDiff(client, server)
      }
      return null
    },
    projectChangesDetected () {
      return !!this.diffs.raw2 || !isEmpty(this.filesDiff?.flags)
    },
    diffs () {
      if (this.projectInfo) {
        const ignoredFields = ['client_info', 'project_hash']
        const orig = omit(this.project.meta, ignoredFields)
        const current = omit(this.projectInfo, ignoredFields)
        const meta = isEqual(current, orig)

        const layersIds = {
          orig: Object.keys(orig.layers),
          current: Object.keys(current.layers)
        }
        const newLayers = difference(layersIds.current, layersIds.orig)
        const removedLayers = difference(layersIds.orig, layersIds.current)
        const changedLayers = layersIds.current.filter(id => orig.layers[id] && !isEqual(current.layers[id], orig.layers[id]))
        const checkAttribs = (l1, l2) => isEqual(l1.attributes?.map(a => a.name), l2.attributes?.map(a => a.name))
        const changedAttrsLayers = changedLayers.filter(id => !checkAttribs(orig.layers[id], current.layers[id]))
        const metaDiff = objDiff(current, orig)
        const metaDiff2 = objectDiff(current, orig)
        return {
          equal: meta,
          raw: isEmpty(metaDiff) ? null : metaDiff,
          raw2: Object.keys(metaDiff2).length > 1 ? metaDiff2 : null, // empty object will have $diff property
          newLayers,
          // newLayers: newLayers.map(id => current.layers[id].title),
          removedLayers,
          // removedLayers: removedLayers.map(id => orig.layers[id].title),
          changedLayers,
          // changedLayers: changedLayers.map(id => current.layers[id].title),
          changedAttrsLayers
        }
      }
      return null
    },
    projectInfo2 () {
      if (this.projectInfo && this.diffs.removedLayers.length) {
        const orig = this.project.meta
        const tree = cloneDeep(this.projectInfo.layers_tree)
        const layers = { ...this.projectInfo.layers }
        this.diffs.removedLayers.forEach(id => {
          const path = findLayer(orig.layers_tree, id)
          insertLayer(tree, path)
          layers[id] = orig.layers[id]
        })
        return {
          layers_tree: tree,
          layers
        }
      }
      return this.projectInfo
    },
    diffLayersClasses () {
      const classes = {}
      if (this.diffs) {
        this.diffs.removedLayers.forEach(id => {
          classes[id] = 'removed'
        })
        this.diffs.newLayers.forEach(id => {
          classes[id] = 'new'
        })
        this.diffs.changedLayers.forEach(id => {
          classes[id] = 'changed'
        })
      }
      return classes
    },
    lastProjectFile () {
      return path.join(this.project.meta.client_info.directory, this.project.meta.file)
    },
    currentProjectFile () {
      return this.projectInfo && path.join(this.projectInfo.client_info.directory, this.projectInfo.file)
    },
    layersErrors () {
      return layersErrors(this.projectInfo)
    },
    clientDirtyFiles () {
      if (this.tasks.clientFiles.data) {
        const { files, temporary } = this.tasks.clientFiles.data
        return findDirtyFiles(files, temporary)
      }
      return null
    },
    serverDirtyFiles () {
      if (this.project.files.data) {
        const { files, temporary } = this.project.files.data
        return findDirtyFiles(files, temporary)
      }
      return null
    },
    sourceDirtyFiles () {
      return this.isPushMode ? this.clientDirtyFiles : this.serverDirtyFiles
    },
    targetDirtyFiles () {
      if (this.splitFilesMode) {
        return this.isPushMode ? this.serverDirtyFiles : this.clientDirtyFiles
      }
      return (this.clientDirtyFiles || this.serverDirtyFiles) && [...this.clientDirtyFiles ?? [], ...this.serverDirtyFiles ?? []]
    },
    wfsNotEnabled() {
      if (!this.projectInfo || !this.projectInfo.layers) {
        return false
      }
      
      // Check for vector layers without WFS enabled
      const vectorLayers = Object.values(this.projectInfo.layers)
        .filter(l => l.type === 'VectorLayer')
        .filter(l => !l.error)
      
      // Show WFS button if we have at least one vector layer without WFS
      return vectorLayers.length && vectorLayers.some(l => !l.options.wfs.length)
    }
  },
  activated () {
    const unbind = this.$ws.bind('ProjectChanged', this.onProjectChange)
    this.$once('hook:deactivated', unbind)
    if (this.connected) {
       this.fetchClientProjectInfo()
    }
  },
  watch: {
    connected (connected) {
      if (!this._inactive && connected) {
        this.onProjectChange()
      }
    }
  },
  methods: {
    async onProjectChange () {
      await this.fetchClientProjectInfo()
      if (this.tasks.clientFiles.success) {
        this.tasks.clientFiles = TaskState()
        this.fetchLocalFiles()
      }
    },
    async fetchClientProjectInfo (skipLayersWithError=false) {
      if (!this.connected) {
        return
      }
      this.pluginError = null
      const params = {
        skip_layers_with_error: skipLayersWithError
      }
      try {
        const { data } = await this.$ws.request('ProjectInfo', params)
        Object.values(data.layers).forEach(l => {
          if (!l.type.endsWith('Layer')) {
            l.type = l.type + 'Layer'
          }
        })
        this.projectInfo = data
      } catch (err) {
        this.projectInfo = null
        this.pluginError = {
          code: err.status,
          msg: err.data || 'Error',
          details: err.traceback
        }
      }
    },
    fetchLocalFiles () {
      const task = this.$ws.request('ProjectFiles')
      watchTask(task, this.tasks.clientFiles)
    },
    fetchServerFiles () {
      this.project.files.fetch()
    },
    fetchFiles () {
      if (!this.tasks.clientFiles.data) {
        this.fetchLocalFiles()
      }
      if (!this.project.files.data) {
        this.fetchServerFiles()
      }
    },
    async updateFiles (files, removedFiles) {
      if (removedFiles?.length) {
        const data = {
          files: removedFiles
        }
        try {
          await this.$http.delete(`/api/project/files/${this.project.name}`, { data })
        } catch (err) {
          throw new Error('Failed to remove files')
        }
      }
      this.upload = createUpload(this.$ws, files, this.project.name)
      this.uploadProgress = this.upload.info
      try {
        await this.upload.start()
      } catch (e) {
        if (e !== 'aborted') {
          throw e
        }
      } finally {
        // this.fetchServerFiles()
        this.uploadProgress = null
        // this.$notify.success('Files was uploaded')
      }
    },
    getFilesToUpdate () {
      const files = {
        update: [...this.filesDiff.new, ...this.filesDiff.updated],
        remove: []
      }
      if (this.filesUpdateOpt === 'selected') {
        const lookup = new Set(this.selectedFiles)
        files.update = files.update.filter(f => lookup.has(f.path))
        files.remove = this.filesDiff.removed.filter(p => lookup.has(p))
      }
      if (this.filesUpdateOpt === 'all') {
        files.remove = this.filesDiff.removed
      }
      return files
    },
    async pushChanges () {
      const filesChanges = this.updateOpts.files
        ? this.getFilesToUpdate()
        : {
            update: [{
              path: this.projectInfo.file,
              hash: this.projectInfo.project_hash
            }]
          }

      if (this.updateOpts.qgisProject) {
        const settings = cloneDeep(this.settings)
        this.diffs.newLayers.forEach(id => {
          const layerMeta = this.projectInfo.layers[id]
          settings.layers[id] = { flags: [...layerMeta.flags] }
          settings.auth.roles?.forEach(role => {
            role.permissions.layers[id] = []
            if (layerMeta.attributes) {
              role.permissions.attributes[id] = Object.fromEntries(layerMeta.attributes.map(a => [a.name, []]))
            }
          })
        })
        if (settings.auth.roles) {
          this.diffs.changedLayers.forEach(id => {
            const layerMeta = this.projectInfo.layers[id]
            if (layerMeta.attributes) {
              const currentAttrs = layerMeta.attributes?.map(a => a.name)
              const origAttrs = this.project.meta.layers[id].attributes?.map(a => a.name)
              const newAttrs = difference(currentAttrs, origAttrs)
              const removedAttrs = difference(origAttrs, currentAttrs)
              if (newAttrs.length || removedAttrs.length) {
                settings.auth.roles?.forEach(role => {
                  removedAttrs.forEach(name => delete role.permissions.attributes[id][name])
                  newAttrs.forEach(name => {
                    role.permissions.attributes[id][name] = []
                  })
                })
              }
            }
          })
        }
        if (this.diffs.removedLayers.length) {
          this.diffs.removedLayers.forEach(id => {
            delete settings.layers[id]
            settings.auth.roles?.forEach(role => {
              delete role.permissions.layers[id]
              delete role.permissions.attributes[id]
            })
          })
          settings.topics?.forEach(t => {
            t.visible_overlays = t.visible_overlays.filter(id => !this.diffs.removedLayers.includes(id))
          })
        }
        if (this.diffs.changedAttrsLayers.length) {
          this.diffs.changedAttrsLayers.forEach(id => {
            const layerMeta = this.projectInfo.layers[id]
            const lset = settings.layers[id]
            const currentAttrs = layerMeta.attributes?.map(a => a.name) ?? []
            // v1 - applies changes from metadata diff
            /*
            const origAttrs = this.project.meta.layers[id].attributes?.map(a => a.name)
            const newAttrs = difference(currentAttrs, origAttrs)
            const removedAttrs = difference(origAttrs, currentAttrs)
            console.log('newAttrs', newAttrs, 'removedAttrs', removedAttrs)
            removedAttrs.forEach(n => delete lset.attributes?.[n])
            if (lset.fields_order) {
              for (const [k, v] of Object.entries(lset.fields_order)) {
                const newList = v.filter(n => !removedAttrs.includes(n))
                lset.fields_order[k] = [...newList, ...newAttrs.filter(n => !newList.includes(n))]
              }
            }
            if (lset.excluded_fields) {
              // remove non existing attributes
              for (const [k, v] of Object.entries(lset.excluded_fields)) {
                lset.excluded_fields[k] = v.filter(n => !removedAttrs.includes(n))
              }
            }
            */
            // v2 - applies changes to match latest metadata
            // delete settings of not existing attributes
            if (lset.attributes) {
              Object.keys(lset.attributes).forEach(n => {
                if (!currentAttrs.includes(n)) {
                  delete lset.attributes[n]
                }
              })
            }
            if (lset.fields_order) {
              for (const [k, v] of Object.entries(lset.fields_order)) {
                // remove non existing attributes
                const fields = v.filter(n => currentAttrs.includes(n))
                // add missing attributes
                fields.push(...currentAttrs.filter(n => !fields.includes(n)))
                lset.fields_order[k] = fields
              }
            }
            if (lset.excluded_fields) {
              // remove non existing attributes
              for (const [k, v] of Object.entries(lset.excluded_fields)) {
                lset.excluded_fields[k] = v.filter(n => currentAttrs.includes(n))
              }
            }
          })
        }
        await this.$http.post(`/api/project/meta/${this.project.name}`, omit(this.projectInfo, ['dirty', 'filesize']))
        await this.$http.post(`/api/project/settings/${this.project.name}`, settings)
      }
      if (filesChanges.update?.length || filesChanges.remove?.length) {
        try {
          await this.updateFiles(filesChanges.update, filesChanges.remove)
        } catch (err) {
          console.error(err)
          this.$notify.error(err.message || 'Failed to update files')
          return
        }
        this.fetchServerFiles()
      }
      this.$notify.success('Project was updated')
      this.selectedFiles = []
      this.updateOpts = {
        qgisProject: false,
        files: false
      }
      this.fetchProjectInfo()
      const [ user, name ] = this.project.name.split('/')
      this.$router.push({ name: 'project', params: { user, name: name } })
    },
    updateFilesSelection () {
      if (this.isPushMode && this.filesUpdateOpt === 'selected') {
        const isProjectFileSelected = this.selectedFiles?.includes(this.projectInfo.file)
        if (this.updateOpts.qgisProject !== isProjectFileSelected) {
          if (this.updateOpts.qgisProject) {
            this.selectedFiles.push(this.projectInfo.file)
          } else {
            this.selectedFiles.splice(this.selectedFiles.indexOf(this.projectInfo.file), 1)
          }
        }
      }
    },
    toggleMode () {
      this.updateMode = this.isPushMode ? 'pull' : 'push'
      this.updateFilesSelection()
    },
    isFileDisabled (item) {
      if (this.isPushMode && item.path === this.projectInfo.file && (!!this.diffs.raw2 || this.project.meta.project_hash !== this.projectInfo.project_hash)) {
        return true
      }
      return !(this.filesDiff.flags?.[item.path])
    },
    async pullChanges () {
      const filesChanges = this.getFilesToUpdate()
      if (filesChanges.remove?.length) {
        const params = {
          project: this.project.name,
          files: filesChanges.remove
        }
        try {
          await this.$ws.request('DeleteFiles', params)
        } catch (err) {
          console.error(err)
          this.$notify.error('Delete Error')
        }
      }

      const params = {
        project: this.project.name,
        files: filesChanges.update
      }
      this.fetchStatus = {
        finished: [],
        errors: []
      }
      const unbind = this.$ws.bind('FetchStatus', (msg) => {
        const { status, file } = msg.data
        if (status === 'finished') {
          this.fetchStatus.finished.push(file)
        } else if (status === 'error') {
          this.fetchStatus.errors.push(file)
        }
      })
      try {
        await this.$ws.request('FetchFiles', params)
        unbind()
        if (this.fetchStatus.errors.length) {
          this.$notify.error(`Failed to fetch files: ${this.fetchStatus.errors.length}`)
        } else {
          this.$notify.success('Local project was updated')
        }
        this.selectedFiles = []
        this.fetchStatus = null
        this.fetchLocalFiles()
      } catch (err) {
        console.error(err)
      }
    },
    async reloadQgisProject () {
      try {
        await this.$http.post(`/api/project/reload/${this.project.name}`)
        this.$notify.success('Project reload request was successful')
      } catch (err) {
        this.$notify.error('Project reload request failed')
      }
    },
    enableWFS() {
      console.log('Enabling WFS for vector layers')
      this.$ws.request('EnableLayersWFS')
        .then(() => {
          this.$notify.success('WFS successfully enabled')
          // Refresh project info after enabling WFS
          setTimeout(() => this.fetchClientProjectInfo(), 1000)
        })
        .catch(err => {
          console.error('Error enabling WFS:', err)
          this.$notify.error('Failed to enable WFS')
        })
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/card.scss';

.card {
  border: 1px solid #ddd;
  margin: 3px 1px 6px 3px;
  box-shadow: none;
}
.toggle.btn {
  .icon {
    transition: all .4s cubic-bezier(.25,.8,.25,1);
  }
  &.flip {
    .icon {
      transform: rotate(180deg);
    }
  }
}
.files-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.btn.load {
  align-self: center;
}
.warning {
  background-color: var(--color-orange);
  color: #fff;
  --icon-color: currentColor;
  font-weight: 500;
  padding: 4px 8px;
  justify-content: center;
}
.warning-detail {
  background-color: #eee;
  background-color: rgba(var(--color-orange-rgb), 0.3);
  padding: 2px 8px;
}
.error-box {
  background-color: rgba(var(--color-orange-rgb), 0.3);
  font-size: 14px;
  .icon {
    align-self: center;
  }
  p {
    line-height: 1.2;
    margin-block: auto;
  }
}
.subtitle {
  font-size: 13px;
  text-transform: uppercase;
  font-weight: 500;
  text-decoration: underline;
}
.plugin-error {
  .title {
    color: var(--color-red);
    font-size: 18px;
  }
  .traceback {
    white-space: pre-line;
    font-family: monospace;
    font-size: 13px;
  }
}
.files-options {
  .radio-btn {
    margin-bottom: 0;
  }
  .description {
    margin-left: 36px;
    font-size: 13px;
    opacity: 0.7;
    max-width: 280px;
    line-height: 1.25;
  }
}
.statusbar {
  background-color: #f2f2f2;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
  font-weight: 500;
  .new {
    color: var(--color-green);
  }
  .removed {
    color: var(--color-red);
  }
  .changed {
    color: var(--color-orange);
  }
}

:deep(.layers-table) {
  tr {
    --status-color: #2c3036;
    color: var(--status-color, currentColor);
    --icon-color: var(--color-status);
  }
  tr.new {
    --status-color: var(--color-green);
  }
  tr.removed {
    --status-color: var(--color-red);
  }
  tr.changed {
    --status-color: var(--color-orange);
  }
}
.vjs-tree, .json-viewer, .json-diff-viewer {
  width: clamp(50vw, 1260px, 90vw);
  min-height: 90vh;
  padding: 12px;
  overflow: auto;
}
.metadata-view {
  overflow: hidden;
}
.action {
  .btn {
    min-width: 200px;
  }
}
.dialog {
  .toolbar {
    height: 38px;
    flex-shrink: 0;
    background-color: var(--color-dark);
    border-bottom: 1px solid #ddd;
    --fill-color: #fff;
    .title {
      font-size: 17px;
      font-weight: 500;
    }
  }
}
hr {
  opacity: 0.7;
}
.files-grid {
  display: grid;
  grid-template-columns: 1fr;
  &.split {
    background-color: #bbb;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    &.push {
      .source {
        grid-area: 1 / 1 / 2 / 2;
      }
      .target {
        grid-area: 1 / 2 / 2 / 3;
      }
    }
  }
  .target, .source {
    background-color: #fff;
  }
  .label {
    padding: 0 8px;
    font-weight: 500;
    background-color: #ddd;
  }
}
.mode {
  background-color: #eee;
  padding: 4px 6px;
  .title {
    font-weight: 500;
    font-size: 18px;
  }
  .description {
    opacity: 0.7;
    font-size: 14px;
  }
  .arrow {
    transition: all ease 0.3s;
    will-change: transform;
    // color: var(--color-primary);
  }
  &.pull {
    .arrow {
      transform: scale(-1, 1);
    }
  }
  .client {
    border-radius: 3px;
  }
  .label {
    text-transform: uppercase;
    font-weight: 500;
    font-size: 12px;
    opacity: 0.7;
  }
  .btn.small {
    font-size: 13px;
    margin-block: 3px 0;
    height: 22px;
  }
}
.folder-badge {
  position: absolute;
  bottom: 4px;
  right: 4px;
  height: 7px;
  width: 16px;
  pointer-events: none;
}
.expanded {
  .folder-badge {
    width: 15px;
    transform: skewX(-18deg);
  }
}
.file-badge {
  position: absolute;
  right: 0;
  top: -4px;
  background-color: #fff;
  border-radius: 10px;
  padding: 0 1px 1px;
}
.btn.inline {
  display: inline-flex;
}
</style>
``` 
