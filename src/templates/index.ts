import {Template} from './Template.js';
import {PythonApiTemplate} from "./PythonApiTemplate.js";

/**
 * 加载所有可用的模板
 */
export function loadTemplates(): Template[] {
    return [
        new PythonApiTemplate()
    ];
}
