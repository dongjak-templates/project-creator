import {Template} from './Template.js';
import {PythonWebTemplate} from "./PythonWebTemplate.js";
import {RefineAdminTemplate} from "./RefineAdminTemplate.js";
import {PythonLibraryTemplate} from "./PythonLibraryTemplate.js";
import {DockerComposeTemplate} from "./DockerComposeTemplate.js";

/**
 * 加载所有可用的模板
 */
export function loadTemplates(): Template[] {
    return [
        new PythonWebTemplate(),
        new RefineAdminTemplate(),
        new PythonLibraryTemplate(),
        new DockerComposeTemplate()
    ];
}
