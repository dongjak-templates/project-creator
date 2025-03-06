import {Template} from './Template.js';
import {RefineAdminTemplate} from "./RefineAdminTemplate.js";
import {PythonLibraryTemplate} from "./PythonLibraryTemplate.js";
import {DockerComposeTemplate} from "./DockerComposeTemplate.js";
import {FastApiTemplate} from "./FastApiTemplate.js";

/**
 * 加载所有可用的模板
 */
export function loadTemplates(): Template[] {
    return [
        new RefineAdminTemplate(),
        new PythonLibraryTemplate(),
        new DockerComposeTemplate(),
        new FastApiTemplate()
    ];
}
