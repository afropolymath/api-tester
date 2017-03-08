const Mustache = require('mustache'),
  async = require('async'),
  Promise = require('bluebird'),
  rp = require('request-promise'),
  _ = require('lodash');

/**
 * ApiTester class
 */
class ApiTester {
  /**
   * Create a new ApiTester instance
   * @param {string} name       - Name for the ApiTester instance
   * @param {string} base_url   - API Base URL
   */
  constructor({ name, base_url }) {
    this.name = name
    this.base_url = base_url
    this._taskGroups = {}
    this._context = {}
    this._logs = []
  }

  /**
   * Add a task group to this ApiTester instance
   * @param {string} name       - Name of the task group
   * @param {object} taskGroup  - Task group object
   */
  addTaskGroup(name, taskGroup) {
    if (this._taskGroups[name]) {
      throwError('This task group name already exists')
    }
    this._taskGroups[name] = taskGroup
  }

  /**
   * Run all the tasks in a particular task group
   * @param {string} taskGroupName  - Name of the task group to run
   */
  runAll(taskGroupName) {
    const taskGroup = this._taskGroups[taskGroupName]
    if (!taskGroup) {
      return false
    }
    async.eachSeries(taskGroup.listTasks(), (task, done) => {
      return this.runTask(task, this._getContext())
      .then(() => {
        console.log("Done with ==> " + task.request.method + ' ' + task.request.url)
        done()
      })
      .catch((err) => {
        console.log(err)
        done(err)
      })
    }, (res) => {
      console.log("[^_^] Done!");
    });
  }

  /**
   * Run single task using the current state (context)
   * @param {object} task       - Task object to run
   * @param {object} context    - Current state the application
   */
  runTask(task, context) {
    var parsedUrl = Mustache.render(task.request.url, context);
    return rp({
      url: this._url(parsedUrl),
      method: task.request.method,
      json: true,
      body: _.isFunction(task.request.body) ? task.request.body(context) : task.request.body
    })
    .then((response) => {
      if (task.store) {
        _.forEach(task.store, (_k, k) => {
          this._addContextVariable(k, _k, response)
        })
      }
      if(task.callback) {
        task.callback(response)
      }
      return
    })
    .catch((err) => {
      this._logs.push(err)
    })
  }

  /**
   * Private function to add a new stored variable
   * @param {object} key        - Variable key to create in store
   * @param {object} mapped_to  - Member of response this key points to
   * @param {object} response   - Response from the request
   */
  _addContextVariable(key, mapped_to, response) {
    this._context[key] = mapped_to === '.' ? response : response[mapped_to]
  }
  
  /**
   * Private function to format the request URL
   * @param {string} path   - Resource path relative to base URL
   * @return {string}       - Formatted URL with base URL
   */
  _url(path) {
    return this.base_url + path
  }

  /**
   * Get the current context state
   * @return {object}     - Current context state
   */
  _getContext() {
    return this._context
  }
}

ApiTester.TaskGroup = class TaskGroup {
  /**
   * @constructor
   */
  constructor() {
    this._tasks = []
  }

  /**
   * Add a new task to this task group
   * @param {object} task   - Task to add to group
   */
  addTask(task) {
    this._tasks.push(task)
  }

  /**
   * Add a bunch of tasks to this task group
   * @param {array} tasks   - List of tasks to add to group
   */
  addTasks(tasks) {
    _.forEach(tasks, (task) => {
      this._tasks.push(task)
    })
  }

  /**
   * Return a list of all the task in this task group
   * @return {array}    - List of all the tasks in this task group
   */
  listTasks() {
    return this._tasks
  }
}

module.exports = {
  ApiTester,
  TaskGroup
}