import {
    CreateAgentMarkerTaskParams,
    CreateAgentMarkerTaskResultData,
} from "../../../common/src";
import { Task, TaskHandler } from "../TaskHandler";

export class DesignTaskHandler extends TaskHandler<CreateAgentMarkerTaskParams> {
    readonly taskType = "createAgentMarker";

    async handle(task: Task<CreateAgentMarkerTaskParams>): Promise<void> {
        const { label, prompt, width = 260, height = 72, x, y } = task.params;

        if (!label || !prompt) {
            task.sendError("createAgentMarker task requires 'label' and 'prompt' parameters");
            return;
        }

        const rectangle = penpot.createRectangle();
        rectangle.name = label;
        rectangle.resize(width, height);
        rectangle.borderRadius = 12;
        rectangle.fills = [{ fillColor: "#FFF3C4", fillOpacity: 1 }];
        rectangle.strokes = [
            {
                strokeColor: "#C98A00",
                strokeStyle: "solid",
                strokeWidth: 2,
                strokeAlignment: "center",
            },
        ];

        rectangle.x = x ?? penpot.viewport.center.x;
        rectangle.y = y ?? penpot.viewport.center.y;

        const text = penpot.createText(label);
        if (text) {
            text.x = rectangle.x + 12;
            text.y = rectangle.y + 12;
        }

        const result: CreateAgentMarkerTaskResultData = {
            shapeName: label,
            createdShapeId: rectangle.id,
            createdTextId: text?.id,
        };

        task.sendSuccess(result);
    }
}
