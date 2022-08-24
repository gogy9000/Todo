import {InitialStateTodoType, TaskType, TodoTitleType} from "../../Types";
import {API, Data, TodoListItem} from "../../DAL/TodoAPI";
import {AppRootStateType} from "../ReduxStore";
import {v1} from "uuid";
import {actionsApp} from "../Application/AppReducer";
import {errorsInterceptor, handleClientsError, handlerNetworkError} from "../../utils/HadleErrorUtils";
import {createAsyncThunk, createSlice, Draft, PayloadAction} from "@reduxjs/toolkit";
import {AxiosResponse} from "axios";
import {ThunkResult} from "@reduxjs/toolkit/dist/query/core/buildThunks";
import {FulfilledActionFromAsyncThunk} from "@reduxjs/toolkit/dist/matchers";

enum todo {
    todo = 'todo',
    deleteTask = 'todo/deleteTask',
    getTodolistAndTasks = "todo/getTodolistAndTasks",
    getTasks = "todo/getTasks",
    updateTask = "todo/updateTask",
    addTask = "todo/addTask",
    deleteTodolist = "todo/deleteTodolist",
    createTodolist = "todo/createTodolist",
    updateTodoList = "todo/updateTodoList",
    synchronizeTodo = "todo/synchronizeTodo",
    synchronizeTask = "todo/synchronizeTask",
    synchronizeTasks = "todo/synchronizeTasks",
    synchronizeTodos = "todo/synchronizeTodos"
}

export const thunks = {
    synchronizeTodos: createAsyncThunk(todo.synchronizeTodos, (param, {dispatch, getState}) => {
        const state = getState() as AppRootStateType
        state.toDoReducer.tasksTitle.forEach((todo) => {
                dispatch(thunks.synchronizeTodo(todo))
            }
        )
    }),

    synchronizeTodo: createAsyncThunk
    (todo.synchronizeTodo, async (todo: TodoListItem, {dispatch, getState}) => {
        const state = getState() as AppRootStateType
        if (todo.isASynchronizedTodo) {
            const promise = API.createTodoList(todo.title).then((response) => {
                if (response.data.resultCode === 0) {
                    dispatch(actions.createNewTodoAC(response.data.data.item))
                    let promise = new Promise((resolve, reject) => {
                        if (state.toDoReducer.taskBody[todo.id].length === 0) {
                            reject('activeTasks-empty')
                        }
                        state.toDoReducer.taskBody[todo.id].forEach(
                            (task, i, arr) => {
                                if (task.isASynchronizedTask) {
                                    dispatch(thunks.synchronizeTask({...task, todoListId: response.data.data.item.id}))
                                }
                                if (i === arr.length - 1) {
                                    resolve('success')
                                }
                            }
                        )
                    })
                    Promise.allSettled([promise])
                        .then(() => {
                            dispatch(actions.removeTodoAC(todo.id))

                        })

                }
                return response
            })
            errorsInterceptor(dispatch, [promise])
            return promise
        }
        dispatch(thunks.synchronizeTasks(todo))
    }),

    synchronizeTasks: createAsyncThunk(todo.synchronizeTasks, (todo: TodoListItem, {dispatch, getState}) => {
        const state = getState() as AppRootStateType
        if (!todo.isASynchronizedTodo) {
            for (const task of state.toDoReducer.taskBody[todo.id]) {
                if (task.isASynchronizedTask) {
                    dispatch(thunks.synchronizeTask({...task, todoListId: todo.id}))
                }
            }
        }
    }),

    synchronizeTask: createAsyncThunk(todo.synchronizeTask, async (task: TaskType, {dispatch}) => {
        const promise = API.createNewTask(task.todoListId, task.title).then((response) => {
                if (response.data.resultCode === 0) {
                    dispatch(actions.addTaskAC(response.data.data.item))
                    if (task.status !== 0) {
                        dispatch(thunks.updateTask({...response.data.data.item, status: task.status}))
                    }
                    // dispatch(actions.deleteTask({taskId: task.id, todoId: task.todoListId}))
                    dispatch(thunks.deleteTask(task))
                }
                return response
            }
        )
        errorsInterceptor(dispatch, [promise])
        return promise
    }),

    getTodolistAndTasks: createAsyncThunk
    (todo.getTodolistAndTasks, async (param, {dispatch, getState}) => {
        let state = getState() as AppRootStateType
        if (state.toDoReducer.offlineMode) {
            return
        } else {
            try {
                dispatch(actionsApp.toggleIsWaitingApp(true))
                const response = await API.getTodoList()
                if (response.status === 200) {
                    dispatch(actions.refreshTodoListAC(response.data))
                    response.data.forEach((todo) => {
                        dispatch(thunks.getTasks({todolistId: todo.id}))
                    })

                } else {
                    handleClientsError(dispatch, [response.statusText])
                }
                return response
            } catch (error) {
                handlerNetworkError(dispatch, error)
            } finally {
                dispatch(actionsApp.toggleIsWaitingApp(false))
            }
        }
    }),

    getTasks: createAsyncThunk(todo.getTasks, async ({todolistId}: { todolistId: string }, {dispatch}) => {
        const response = await API.getTasks(todolistId)
        if (response.status === 200) {
            dispatch(actions.refreshTasks(response.data.items))
        }
        // errorsInterceptor(dispatch,[response])
    }),

    createTodolist: createAsyncThunk(todo.createTodolist, async (title: string, {dispatch, getState}) => {
        const state = getState() as AppRootStateType
        if (title.length > 100) {
            const error = "The field Title must be a string or array type with a maximum length of '100'. (Title)"
            handleClientsError(dispatch, [error])
        } else {
            const newASynchronizedTodo = {
                id: v1(),
                title: title,
                addedDate: JSON.stringify(new Date()),
                order: 0,
                isASynchronizedTodo: true
            }
            dispatch(actions.createNewTodoAC(newASynchronizedTodo))
            if (!state.toDoReducer.offlineMode) {
                dispatch(thunks.synchronizeTodo(newASynchronizedTodo))
            }
        }
    }),

    updateTodoList: createAsyncThunk(todo.updateTodoList, async (todo: TodoListItem, {dispatch}) => {
        const {title, id, isASynchronizedTodo} = todo
        if (isASynchronizedTodo) {
            if (title.length > 100) {
                const error = "The field Title must be a string or array type with a maximum length of '100'. (Title)"
                handleClientsError(dispatch, [error])
            } else {
                dispatch(actions.updateTodoNameAC({title, id}))
            }
        } else {
            const promise = API.updateTodoLis(id, title).then((response) => {
                if (response.data.resultCode === 0) {
                    dispatch(actions.updateTodoNameAC({title, id}))
                }
                return response
            })
            errorsInterceptor(dispatch, [promise])
            return promise
        }
    }),

    deleteTodolist: createAsyncThunk
    (todo.deleteTodolist, async (todo: TodoListItem, {dispatch}) => {
        const {id, isASynchronizedTodo} = todo
        if (isASynchronizedTodo) {
            dispatch(actions.removeTodoAC(todo.id))
        } else {
            const promise = API.deleteTodoList(id).then((response) => {
                if (response.data.resultCode === 0) {
                    dispatch(actions.removeTodoAC(id))
                }
                return response
            })
            errorsInterceptor(dispatch, [promise])
            return promise
        }
    }),

    addTask: createAsyncThunk
    (todo.addTask, async (param: { todo: TodoListItem, taskTitle: string }, {
        dispatch,
    }) => {
        const {todo, taskTitle} = param
        const newASynchronizedTask: TaskType = {
            description: null,
            title: taskTitle,
            status: 0,
            priority: 0,
            startDate: null,
            deadline: null,
            id: v1(),
            todoListId: todo.id,
            order: 0,
            addedDate: JSON.stringify(new Date()),
            isASynchronizedTask: true,

        }
        if (todo.isASynchronizedTodo) {

            if (taskTitle.length > 100) {
                const error = "The field Title must be a string or array type with a maximum length of '100'. (Title)"
                handleClientsError(dispatch, [error])
            } else {
                dispatch(actions.addTaskAC(newASynchronizedTask))
            }
        } else {
            const promise = API.createNewTask(todo.id, taskTitle).then((response) => {
                if (response.data.resultCode === 0) {
                    dispatch(actions.addTaskAC(response.data.data.item))
                }
                return response
            })
            errorsInterceptor(dispatch, [promise])
            return promise
        }
    }),

    updateTask: createAsyncThunk(todo.updateTask, async (task: TaskType, {dispatch, rejectWithValue}) => {
        if (task.isASynchronizedTask) {
            if (task.title.length > 100) {
                const error = "The field Title must be a string or array type with a maximum length of '100'. (Title)"
                handleClientsError(dispatch, [error])
            } else {
                dispatch(actions.updateTaskAC(task))
            }
        } else {
            const promise = API.updateTask(task).then((response) => {
                if (response.data.resultCode === 0) {
                    dispatch(actions.updateTaskAC(response.data.data.item))
                }
                return response
            })
            errorsInterceptor(dispatch, [promise])
            return promise
        }
    }),

    deleteTask: createAsyncThunk<{ response: Data,task:TaskType }, TaskType, {}>
    (todo.deleteTask, async (task: TaskType, thunkAPI) => {
            if (task.isASynchronizedTask) {
                return {response: {data: {}, fieldsErrors: [""], messages: [""], resultCode: 0}, task}
            } else {
                    const promise = await  API.deleteTask(task.todoListId, task.id)
                        return {response:promise.data, task}}
        }
    )
}


export const initialState: InitialStateTodoType =
    {
        tasksTitle: [],
        taskBody: {},
        offlineMode: true,
        waitingList: {},
        errors:[]
    }

const todoSlice = createSlice({
    name: todo.todo,
    initialState: initialState,
    reducers: {
        removeTodoAC: (state, action: PayloadAction<string>) => {
            state.tasksTitle = state.tasksTitle.filter(todo => todo.id !== action.payload)
            delete state.taskBody[action.payload]
        },
        updateTodoNameAC: (state, action: PayloadAction<{ title: string, id: string }>) => {
            state.tasksTitle.forEach(todo => {
                if (todo.id === action.payload.id) {
                    todo.title = action.payload.title
                }
            })
        },
        createNewTodoAC: (state, action: PayloadAction<TodoListItem>) => {
            state.tasksTitle = [...state.tasksTitle, {...action.payload, filter: 'All'}]
            state.taskBody[action.payload.id] = []
        },
        addTaskAC: (state, action: PayloadAction<TaskType>) => {
            state.taskBody[action.payload.todoListId].push(action.payload)
        },
        updateTaskAC: (state, action: PayloadAction<TaskType>) => {
            state.taskBody[action.payload.todoListId] = state.taskBody[action.payload.todoListId]
                .map(task => task.id === action.payload.id ? action.payload : task)
        },
        // deleteTask: (state, action: PayloadAction<{ taskId: string, todoId: string }>) => {
        //     state.taskBody[action.payload.todoId] = state.taskBody[action.payload.todoId]
        //         .filter(task => task.id !== action.payload.taskId)
        // },
        refreshTodoListAC: (state, action: PayloadAction<TodoListItem[]>) => {

            state.tasksTitle = action.payload.reduce((acc, todo: TodoListItem) => {
                return [...acc, {...todo, filter: "All"}]
            }, [] as TodoTitleType[])

            state.taskBody = action.payload.reduce((acc, todo: TodoListItem) => {
                return {...acc, [todo.id]: []}
            }, state.taskBody)
        },
        refreshTasks: (state, action: PayloadAction<TaskType[]>) => {

            state.taskBody = action.payload.reduce((taskBody, newTask) => {
                return {
                    ...taskBody, [newTask.todoListId]: [
                        ...taskBody[newTask.todoListId].filter((oldTask) => oldTask.id !== newTask.id), newTask
                    ]
                }
            }, state.taskBody as { [key: string]: TaskType[] })

        },
        changeUnauthorizedMode: (state, action: PayloadAction<boolean>) => {
            state.offlineMode = action.payload
        },
        changeFilterAC: (state, action: PayloadAction<{ todoId: string, newFilter: string }>) => {
            state.tasksTitle.forEach(todo => {
                if (todo.id === action.payload.todoId) {
                    todo.filter = action.payload.newFilter
                }
            })
        },
        clearErrors: (state, action) => {
            state.errors=action.payload
        }
    },
    extraReducers: builder => {

        const addIdInWaitingList=(state:InitialStateTodoType,id:string)=>{
            return Object.assign(state.waitingList, {[id]: true})
        }
        const removeIdInWaitingList=(state:InitialStateTodoType,id:string)=>{
            return delete state.waitingList[id]
        }
        const networkErrorsInterceptor=(state:InitialStateTodoType,errors?:string)=>{
          return  errors?state.errors.push(errors):state
        }
        const clientsErrorsInterceptor = (state:InitialStateTodoType,errors:string[]) => {
          return   state.errors.concat(errors)
        }

        builder
            .addCase(thunks.deleteTask.pending, (state, action) => {
                addIdInWaitingList(state, action.meta.arg.id)
            })
            .addCase(thunks.deleteTask.fulfilled, (state, action) => {
                if (action.payload.response.resultCode === 0) {
                    state.taskBody[action.payload.task.todoListId] = state.taskBody[action.payload.task.todoListId]
                        .filter(task => task.id !== action.payload.task.id)
                }else {
                    clientsErrorsInterceptor(state,action.payload.response.messages)
                }
                removeIdInWaitingList(state, action.meta.arg.id)
            })
            .addCase(thunks.deleteTask.rejected, (state, action) => {
                networkErrorsInterceptor(state,action.error.message)
                removeIdInWaitingList(state, action.meta.arg.id)
            })
            .addCase(thunks.updateTask.pending, (state, action) => {
                addIdInWaitingList(state, action.meta.arg.id)
            })
            .addCase(thunks.updateTask.fulfilled, (state, action) => {
                 removeIdInWaitingList(state, action.meta.arg.id)
            })
            .addCase(thunks.updateTask.rejected, (state, action) => {
                removeIdInWaitingList(state, action.meta.arg.id)
            })
            .addCase(thunks.addTask.pending, (state, action) => {
                addIdInWaitingList(state, action.meta.arg.todo.id)
            })
            .addCase(thunks.addTask.fulfilled, (state, action) => {
                removeIdInWaitingList(state, action.meta.arg.todo.id)
            })
            .addCase(thunks.addTask.rejected, (state, action) => {
                removeIdInWaitingList(state, action.meta.arg.todo.id)
            })
            .addCase(thunks.deleteTodolist.pending, (state, action) => {
                 addIdInWaitingList(state, action.meta.arg.id)
            })
            .addCase(thunks.deleteTodolist.fulfilled, (state, action) => {
                removeIdInWaitingList(state, action.meta.arg.id)
            })
            .addCase(thunks.deleteTodolist.rejected, (state, action) => {
                removeIdInWaitingList(state, action.meta.arg.id)
            })
    }
})

export let toDoReducer = todoSlice.reducer
export const actions = todoSlice.actions






