# APITester

## Installation

This library is still WIP. You should not install it yet :)

## Usage

### 1. Creating a new `ApiTester` instance:

```js
const apiTester = new ApiTester({
  name: 'Sample API Tester',
  base_url: 'http://localhost:5000/api/v1'
})
```

This expression throws an error if the URL is malformed or if invalid characters were entered in the name key.

> `base_url` should end with a trailing /

### 2. Create a new `ApiTester.TaskGroup` instance:

API tests are grouped under task groups. These task groups contain the tasks that should run but also provide a modular way for organizing different scenarios for your application.

```js
const dummyUserSetup = new ApiTester.TaskGroup()
```

Use the `ApiTester.TaskGroup` constructor to create a new task group instance. The constructor takes no parameter. However, to be able to run tasks within task groups, the task group needs to be added to the `ApiTester` instance. To do this, we employ the `addTaskGroup()`. See below:

```js
const apiTester = new ApiTester({
  name: 'Sample API Tester',
  base_url: 'http://localhost:5000/api/v1'
})
const dummyUserSetup = new ApiTester.TaskGroup()

apiTester.addTaskGroup('DUMMY_USER_SETUP', dummyUserSetup)
```
When adding a task group to the `ApiTester` instance, we specifty a `name` parameter. This parameter will be used to refer to the task group when you want to run specific scenarios.

> Although `name` can be anything, it is recommended that the `name` parameter is written using upper case using underscores to delimit words.

### 3. Working with Tasks:

Tasks are organized as simple objects with specific keys used to represent configuration data for the task. Here's a typical task object structure:

```js
const task = {
  name: 'TASK_NAME',
  request: {
    url: 'RELATIVE_API_URL',
    method: 'REQUEST_METHOD',
    body: {
      variable_1: 'Variable value',
      variable_2: 'Variable value'
    }
  },
  store: {
    store_key: 'path.to.object.or.value'
  },
  callback(response) => {
    // Function that does something with the API response
  }
}
```

Task objects contain 4 main keys for specifying task configuration:

- `name` - Name of the task. Can be used to run a single task
- `request` - Request parameters for the task
- `store` - Mapping of variables to store after executing this task
- `callback` - Function to call after executing the task. `response` is passed as the first parameter to this callback function

#### The `request` object

The `request` object is used to specify request parameters for the API test task. The parameters are similar to those used for the [Node Request Promise Library](https://www.npmjs.com/package/request-promise) as this was used for the underlying implementation. Currently we only support the `body`, `method` and `url` parameters for specifying the request body (for POST and PUT operations), the request method (e.g `get`, `post`, `put` and `delete`) and the relative API URL respectively.

#### The `store` object

This object is used to specify a mapping of the variables that we want to store after the task. The keys represent the key to be used in the context store while the value represents the path to the value we want to store relative to the response object. To store the entire response object, specify a period (`.`) as the value.

An example would be if we wanted to store the user object, the user's id and email address after login, we would do something like this for the store:

```js
{
  userId: '_id',
  email: 'auth.email'
}
```

#### The `callback` function

This is perhaps the easiest part of working with this library. If all fails, you can always `console.log` your response data to inspect the results. The response object is returned after the request and passed as the first parameter to this method. If you don't need the response object, you can use this function to perform some arbitrary action after the request is done.

#### Adding tasks to the task group

Tasks can be added to task groups by calling the task group's `addTask()` method. This method takes a well formed task object and adds it to the task groups list of tasks to run. Tasks are run in the sequence in which they are added.

_In the future, we plan to add support for specifying a priority for your tasks to enable you have more control over the order in which your tasks are run_

Continuing from the above examples, we would have:

```js
dummyUserSetup.addTask(task)
```

As is the case with most people, you probably want to run a bunch of tasks and are afraid of the clutter it will cause on your codebase. Have no fear, `ApiTester` is here. You can add multiple tasks at once using the `addTasks()` method. This method takes an array of tasks as it's parameter and adds all the tasks to the task group's task list.

See an example below of what's possible with the `addTasks()` method.

```js
const clientTasks = require('./tasks/client_tasks.js');
const adminTasks = require('./tasks/admin_tasks.js')

const apiTester = new ApiTester({
  name: 'Sample app tests',
  base_url: 'http://sample-app.herokuapp.com/api/v2/'
})

const adminBlockingFunctionality = ApiTester.TaskGroup('ADMIN_BLOCKING_FUNCTIONALITY')

adminBlockingFunctionality.addTasks([
  clientTasks.createClient,
  clientTasks.createSecondClient,
  clientTasks.makeClientVerified,
  clientTasks.postToSecondClientWall,
  clientTasks.getSecondClientPosts,
  adminTasks.blockSecondClient,
  clientTasks.getSecondClientPosts
])
```

As you can see from the example above, my tasks are organized in different files by role. This way, I can understand my scenarios similar to how I would define user stories.

As you can imagine, you can structure this anyway you want depending on your project architecture. Organizing files by scenarios might be a good possibility to explore.

### 4. Using dynamic variables in task definition

Because we know that not all tasks will be composed of known data. For one, when using JWT-authenticated APIs, we find that we have to populate subsequent URLs with the logged in user's token. Again, have no fear, ApiTester is here :).

The library allows a few customizations with a number of customizations coming up soon.

#### Dynamic URL variables

The `url` value has the extra benefit of being able to be interlaced with variables stored in the `ApiTester` context. To access these variables, simply use the [Mustache](https://github.com/janl/mustache.js) notation (which is infact the library that was used for the underlying implementation) within the URL string with the store variable key you're trying to access as the root value.

For instance, if we wanted to use the variables `userId` and `userAccessToken` representing the user ID and access token that we had stored from a previous request, within our URL, we could do this:

```js
socialFeatures = new ApiTester.TaskGroup()
...

socialFeatures.addTask({
  name: 'GET_USER_POSTS',
  request: {
    url: 'users/{{userId}}/posts?access_token={{userAccessToken}}',
    method: 'get'
  },
  store: {
    posts: '.'
  }
})
```

#### Dynamic Body content
Unfortunately, for now, this library does not support using Mustache notation for variable interpolation in body string values. On the other hand, the body can also be specified as a function that returns an object. The function specified will be called with the context variable as the first parameter. This way, you can, using plain Javascript code, compose dynamic string values.

Here's an example:
```js
socialFeatures = new ApiTester.TaskGroup()
...

socialFeatures.addTask({
  name: 'MAKE_NEW_POST',
  request: {
    url: 'users/{{userId}}/posts?access_token={{userAccessToken}}',
    method: 'post',
    body: function(ctx) {
      return {
        taggedUser: [ctx.user2._id],
        text: "Check this out Ade. This guy is a genius",
        link: "http://github.com/afropolymath"
      }
    }
  }
})
```

As you would observe, this poses a number of advantages for us including giving us the freedom write even more complex operations within the function body if required for data being sent in the request body.

#### Other consideration: Using IIFEs for dynamic object content

In addition to the ways highlighted above for expressing tasks with dynamic content, you may also use IIFEs to enable you write more complex expressions required for composing the task.

```js
var task = (() => {
  // Some complex operations required to customize the task
  return {
    // Task details using the results of the above operations
  }
})()
```

### 4. Running the tasks

After specifying the tasks and all the underlying details, the next thing to do is to run your scenarios. You may run your tasks in any order you want but most commonly, tasks will be run by task group (synonymous for scenarios). As specified earlier, the task group will be referred by the name specified when adding it to the `ApiTester` instance. Call the `runAll()` method with the task group name to run that scenario.

```js

const ApiTester = new ApiTester({
  name: 'API Test that runs',
  base_url: 'http://localhost:8000'
})

const taskGroup = new ApiTester.TaskGroup()

apiTester.addTaskGroup('DEMO_V1_FLOW', taskGroup)
apiTester.runAll('DEMO_V1_FLOW')
```

For now, you are unable to run individual tasks by name but that will be added in the next build.

And that's it. Now you can start automating provisioning your database and inspecting requests as a means to speed up your testing workflow and make it a bit less painful.

## TODOS

As you would notice, the library is barely complete. What's online is just a quick draft version that I've been using on a client project. For future versions, I intend to implement the following:

1. Dynamic variable interpolation for body string values
2. Assertions
3. Assertion reporting
4. Error logs and back tracing
5. Including missing request parameters from request promise.