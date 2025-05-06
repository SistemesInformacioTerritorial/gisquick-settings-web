<template>
  <div class="publish light f-col">
    <plugin-disconnected v-if="!connected" class="f-grow"/>
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
      <v-dialog ref="jsonViewer">
        <template v-slot="{ data }">
          <json-viewer :data="data"/>
        </template>
      </v-dialog>

      <div class="card info f-col">
        <div class="header f-row-ac dark px-4">
          <span class="title">Overview</span>
        </div>
        <qgis-info :meta="projectInfo"/>
        <div v-if="0" class="px-2 f-col-ac">
          <small>
            <a class="link-btn" @click="$refs.jsonViewer.show(projectInfo)">
              <span>Show Raw Gisquick Metadata</span>
            </a>
          </small>
        </div>
        <div v-else class="note px-2">
          <span>
            For more information or troubleshooting, you can
            <a class="link-btn" @click="$refs.jsonViewer.show(projectInfo)">
              <span>show full Gisquick Metadata</span>
            </a>
          </span>
        </div>
      </div>

      <div class="card layers f-col">
        <div class="header f-row-ac dark px-4">
          <span class="title">Layers</span>
        </div>
        <qgis-layers-info :meta="projectInfo"/>
        <layers-errors class="my-2" :errors="layersErrors" :project-info="projectInfo"/>
        <div v-if="wfsNotEnabled" class="note">
          <v-icon name="circle-i-outline"/>
          <span class="m-2">Vector layers without WFS service enabled cannot be queryable.</span>
          <v-btn class="small" color="orange" @click="enableWFS">Enable WFS</v-btn>
        </div>
      </div>

      <div v-if="projectValid" class="card files f-col">
        <div class="header f-row-ac dark px-4">
          <span class="title">Files</span>
          <span class="f-grow"/>
          <v-btn
            v-if="tasks.clientFiles.data"
            class="icon"
            :loading="tasks.clientFiles.pending"
            @click="fetchLocalFiles"
          >
            <v-icon name="reload"/>
          </v-btn>
        </div>
        <v-btn
          v-if="!tasks.clientFiles.data"
          class="load my-4"
          color="primary"
          :loading="tasks.clientFiles.pending"
          @click="fetchLocalFiles"
        >
          Load Files
        </v-btn>

        <template v-else>
          <template v-if="dirtyFiles">
            <div class="error-box f-row p-2">
              <v-icon color="red" name="warning" class="mr-2"/>
              <p>
                Project contains temporary files with unsaved changes. Please reopen your QGIS project to save them.
              </p>
            </div>
          </template>
          <files-tree :files="files" :progress="uploadProgress && uploadProgress.files">
            <template v-if="dirtyFiles" v-slot:file-badge="{ file }">
              <v-icon
                v-if="dirtyFiles.includes(file.path)"
                class="file-badge"
                name="warning"
                color="red"
                size="17"
              />
            </template>
          </files-tree>

          <!-- <div class="f-row-ac f-justify-center">
            <span>{{ user.username }}/</span>
            <v-text-field class="filled" placeholder="name" v-model="name"/>
            <v-btn color="primary" @click="createProject">Upload</v-btn>
          </div> -->
          <div class="note">
            <v-icon name="circle-i-outline" class="mr-2"/>
            <p>You can use .gisquickignore file to exclude some files from uploading them to the server</p>
          </div>
        </template>
      </div>
      <div v-if="!projectValid || dirtyFiles" class="error f-row-ac f-justify-center m-2">
        <v-icon name="warning" size="19" class="mr-2"/>
        <span>Project contains errors</span>
      </div>

      <div v-if="tasks.clientFiles.success && !dirtyFiles" class="submit-form f-row-ac py-2">
        <v-btn
          v-if="!useTemplate"
          color="#777"
          class="outlined n-case"
          :loading="tasks.fetchProjects.pending"
          @click="enableTemplate"
        >
          Use Template
        </v-btn>
        <v-autocomplete
          label="Template"
          placeholder="Select project"
          class="filled inline"
          v-if="tasks.fetchProjects.success"
          :items="tasks.fetchProjects.data"
          item-value="name"
          filter-fields="name,title"
          highlight-fields="name,title"
          v-model="templateProject"
        >
          <template v-slot:item="{ item, html }">
            <div class="ac-item f-row f-grow">
              <div class="f-grow">
                <div class="title" v-html="html.name"/>
                <div class="f-row">
                  <small v-html="html.title" class="f-grow mr-2"/>
                  <small>{{ item.projection }}</small>
                </div>
              </div>
            </div>
          </template>
        </v-autocomplete>
        <div class="f-grow"/>
        <v-text-field
          class="filled inline"
          label="Project Name"
          placeholder="name"
          v-model="name"
          @change="checkAvailability"
        >
          <template v-slot:prepend>
            <span>{{ user.username }}/</span>
          </template>
        </v-text-field>
        <v-btn
          class="upload"
          color="primary"
          :disabled="!name || !projectValid"
          :loading="tasks.createProject.pending"
          @click="uploadProgress ? upload.abort() : createProject()"
        >
          <template v-if="uploadProgress">
            <v-icon name="x"/>
            <v-linear-progress
              color="orange"
              :value="uploadProgress.totalProgress"
            />
            <span>Uploading</span>
          </template>
          <span v-else-if="tasks.createProject.success">Upload</span>
          <span v-else>Create</span>
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
import VAutocomplete from '@/ui/Autocomplete.vue'
import ErrorMessage from '@/components/ErrorMessage.vue'
import LayersErrors, { layersErrors } from '@/components/LayersErrors.vue'
import QgisInfo from '@/components/QgisInfo.vue'
import FilesTree from '@/components/FilesTree.vue'
import QgisLayersInfo from '@/components/QgisLayersInfo.vue'
import PluginDisconnected from '@/components/PluginDisconnected.vue'
import JsonViewer from '@/components/JsonDiffViewer.vue'
// import JsonViewer from '@/components/JsonViewer2.vue'
import { isValidLayerName } from '@/utils/layers'
import { findDirtyFiles } from '@/utils/files'
import { TaskState, watchTask } from '@/tasks'
import { createUpload } from '@/upload'

function layersTree (tree, layers) {
  return tree.map(i => {
    if (i.layers) {
      return {
        name: i.name,
        layers: layersTree(i.layers, layers)
      }
    } else {
      return layers[i.id]
    }
  })
}

const SourceIcons = {
  file: 'hdd',
  postgres: 'storage',
  url: 'globe',
}

export default {
  name: 'PublishView',
  components: { VAutocomplete, ErrorMessage, LayersErrors, FilesTree, QgisInfo, QgisLayersInfo, PluginDisconnected, JsonViewer },
  data () {
    return {
      name: '',
      templateProject: null,
      pluginError: null,
      projectInfo: null,
      opened: [],
      useTemplate: false,
      tasks: {
        clientFiles: TaskState(),
        createProject: TaskState(),
        fetchProjects: TaskState()
      },
      uploadProgress: null
      // test data for styling
      // uploadProgress: { files: {'filename': {progress: 33}} }
    }
  },
  computed: {
    user () {
      return this.$root.user
    },
    connected () {
      return this.$ws.pluginConnected
    },
    layersHeaders () {
      return [
        {
          text: 'Queryable',
          value: 'queryable'
        },
        {
          text: 'CRS',
          value: 'projection',
          align: 'left'
        },
        {
          text: 'Provider',
          value: 'provider_type',
          align: 'left'
        },
        {
          text: 'Source',
          value: 'source',
          align: 'left',
          tdClass: 'src'
        }
      ]
    },
    layers () {
      if (this.projectInfo) {
        const { layers_tree, layers } = this.projectInfo
        return layersTree(layers_tree, layers)
      }
      return []
    },
    layersErrors () {
      return layersErrors(this.projectInfo)
    },
    sourceIcons () {
      return SourceIcons
    },
    files () {
      return this.tasks.clientFiles.data?.files?.filter(f => !f.path.startsWith('.gisquick/'))
    },
    dirtyFiles () {
      if (this.tasks.clientFiles.data) {
        return findDirtyFiles(this.files, this.tasks.clientFiles.data.temporary)
      }
      return null
    },
    wfsNotEnabled () {
      const vectorLayers = Object.values(this.projectInfo.layers).filter(l => l.type === 'VectorLayer')
      return vectorLayers.length && vectorLayers.every(l => !l.options.wfs.length)
    },
    projectionValid () {
      const projCode = this.projectInfo.projection
      // or allow emty proj4 def for well known projections (EPSG:4326, ...)?
      return Boolean(projCode && this.projectInfo.projections[projCode]?.proj4)
    },
    projectValid () {
      return this.projectionValid && !this.layersErrors
    }
  },
  created () {
    const unbind = this.$ws.bind('ProjectChanged', this.onProjectChange)
    this.$once('hook:deactivated', unbind)
    // this.fetchProjectInfo()
  },
  watch: {
    connected: {
      immediate: true,
      handler (connected) {
        if (connected) {
          this.onProjectChange()
        }
      }
    }
  },
  methods: {
    async onProjectChange () {
      await this.fetchProjectInfo()
      if (!!this.files) {
        this.tasks.clientFiles = TaskState()
        this.fetchLocalFiles()
      }
    },
    async fetchProjectInfo (skipLayersWithError=false) {
      if (!this.connected || this.$ws.pluginUpdateRequired) {
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
    enableWFS () {
      this.$ws.request('EnableLayersWFS')
    },
    async fetchLocalFiles () {
      const task = this.$ws.request('ProjectFiles')
      await watchTask(task, this.tasks.clientFiles)
      this.$nextTick(() => {
        this.$el.querySelector('.submit-form')?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      })
    },
    checkAvailability () {
      // console.log('TODO: check availability', this.name)
    },
    async createProject () {
      const projectName = `${this.user.username}/${this.name}`
      if (!this.tasks.createProject.success) {
        const create = this.$http.post(`/api/project/${projectName}`, this.projectInfo)
        await watchTask(create, this.tasks.createProject)
        if (!this.tasks.createProject.success) {
          this.$notify.error(this.tasks.createProject.error)
          return
        }
      }
      // TODO: or create global upload manager, page independent?
      this.upload = createUpload(this.$ws, this.files, projectName)
      this.uploadProgress = this.upload.info
      try {
        await this.upload.start()
        // this.saveConfig()

        // TODO: or maybe project info should be taken from server response
        const project = {
          name: projectName,
          meta: this.projectInfo,
          settings: null,
          thumbnail: false
        }
        const params = {
          user: this.user.username,
          name: this.name,
          publishedProject: project,
          template: this.templateProject
        }
        this.$router.push({ name: 'project', params })
      } catch (e) {
        if (e !== 'aborted') {
          this.$notify.error(e.message ?? 'Error')
        }
      } finally {
        // this.fetchServerFiles()
        this.uploadProgress = null
      }
    },
    async enableTemplate () {
      const t = this.$http.get('/api/projects?filter=accessible')
      await watchTask(t, this.tasks.fetchProjects)
      if (this.tasks.fetchProjects.success) {
        this.useTemplate = true
      }
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/card.scss';

.card {
  border: 1px solid #e3e3e3;
}
.publish {
  // width: clamp(600px, 100%, 1200px);
  grid-column: 2 / 3;
}
// .layers-table {
//   flex: 0 0 auto;
//   // overflow: auto;
//   ::v-deep td.src {
//     white-space: normal;
//   }
// }
.files {
  .load {
    align-self: center;
    justify-self: center;
    min-width: 150px;
  }
}
.upload.btn {
  min-width: 120px;
}
.linear-progress {
  min-width: 80px;
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
.error {
  color: var(--color-red);
  --icon-color: currentColor;
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
.file-badge {
  position: absolute;
  right: 0;
  top: -4px;
  background-color: #fff;
  border-radius: 10px;
  padding: 0 1px 1px;
}
.note {
  display: flex;
  font-size: 13px;
  // opacity: 0.75;
  padding: 3px 8px;
  // align-self: center;
  align-items: center;
  justify-content: center;
  // border-top: 1px solid var(--border-color);
  border-top: 1px solid #e3e3e3;
  background-color: #f4f4f4;
  color: #777;
  --icon-color: #777;
}
.vjs-tree, .json-viewer, .json-diff-viewer {
  width: clamp(50vw, 960px, 80vw);
  min-height: 90vh;
  padding: 12px;
}
</style>
<style lang="scss">
.ac-item {
  small {
    font-size: 12px;
    opacity: 0.7;
  }
}
</style>