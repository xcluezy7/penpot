/**
 * Result of a plugin task execution.
 *
 * Contains the outcome status of a task and any additional result data.
 */
export interface PluginTaskResult<T> {
    /**
     * Optional result data from the task execution.
     */
    data?: T;
}

/**
 * Request message sent from server to plugin.
 *
 * Contains a unique identifier, task name, and parameters for execution.
 */
export interface PluginTaskRequest {
    /**
     * Unique identifier for request/response correlation.
     */
    id: string;

    /**
     * The name of the task to execute.
     */
    task: string;

    /**
     * The parameters for task execution.
     */
    params: any;
}

/**
 * Response message sent from plugin back to server.
 *
 * Contains the original request ID and the execution result.
 */
export interface PluginTaskResponse<T> {
    /**
     * Unique identifier matching the original request.
     */
    id: string;

    /**
     * Whether the task completed successfully.
     */
    success: boolean;

    /**
     * Optional error message if the task failed.
     */
    error?: string;

    /**
     * The result of the task execution.
     */
    data?: T;
}

/**
 * Parameters for the executeCode task.
 */
export interface ExecuteCodeTaskParams {
    /**
     * The JavaScript code to be executed.
     */
    code: string;
}

/**
 * Result data for the executeCode task.
 */
export interface ExecuteCodeTaskResultData<T> {
    /**
     * The result of the executed code, if any.
     */
    result: T;

    /**
     * Captured console output during code execution.
     */
    log: string;
}

/**
 * Parameters for the createAgentMarker task.
 *
 * Creates a small visible marker on the current page so agent actions
 * can be verified in the workspace.
 */
export interface CreateAgentMarkerTaskParams {
    /** Label shown in the created marker/text. */
    label: string;

    /** Original prompt that triggered the action. */
    prompt: string;

    /** Optional explicit viewport-relative position. */
    x?: number;
    y?: number;

    /** Marker dimensions. */
    width?: number;
    height?: number;
}

/**
 * Result data for the createAgentMarker task.
 */
export interface CreateAgentMarkerTaskResultData {
    shapeName: string;
    createdShapeId?: string;
    createdTextId?: string;
}
