var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "typedoc/dist/lib/models/reflections/abstract", "typedoc/dist/lib/converter/components", "typedoc/dist/lib/converter/converter", "typedoc/dist/lib/converter/plugins/CommentPlugin", "typedoc/dist/lib/converter/factories/comment"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var abstract_1 = require("typedoc/dist/lib/models/reflections/abstract");
    var components_1 = require("typedoc/dist/lib/converter/components");
    var converter_1 = require("typedoc/dist/lib/converter/converter");
    var CommentPlugin_1 = require("typedoc/dist/lib/converter/plugins/CommentPlugin");
    var comment_1 = require("typedoc/dist/lib/converter/factories/comment");
    /**
     * This plugin allows an ES6 module to specify its TypeDoc name.
     * It also allows multiple ES6 modules to be merged together into a single TypeDoc module.
     *
     * @usage
     * At the top of an ES6 module, add a "dynamic module comment".  Insert "@module typedocModuleName" to
     * specify that this ES6 module should be merged with module: "typedocModuleName".
     *
     * Similar to the [[DynamicModulePlugin]], ensure that there is a comment tag (even blank) for the
     * first symbol in the file.
     *
     * @example
     * ```
     *
     * &#47;**
     *  * @module newModuleName
     *  *&#47;
     * &#47;** for typedoc &#47;
     * import {foo} from "../foo";
     * export let bar = "bar";
     * ```
     *
     * Also similar to [[DynamicModulePlugin]], if @preferred is found in a dynamic module comment, the comment
     * will be used as the module comment, and documentation will be generated from it (note: this plugin does not
     * attempt to count lengths of merged module comments in order to guess the best one)
     */
    var ExternalModuleNamePlugin = (function (_super) {
        __extends(ExternalModuleNamePlugin, _super);
        function ExternalModuleNamePlugin() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        ExternalModuleNamePlugin.prototype.initialize = function () {
            this.listenTo(this.owner, (_a = {},
                _a[converter_1.Converter.EVENT_BEGIN] = this.onBegin,
                _a[converter_1.Converter.EVENT_CREATE_DECLARATION] = this.onDeclaration,
                _a[converter_1.Converter.EVENT_RESOLVE_BEGIN] = this.onBeginResolve,
                _a));
            var _a;
        };
        /**
         * Triggered when the converter begins converting a project.
         *
         * @param context  The context object describing the current state the converter is in.
         */
        ExternalModuleNamePlugin.prototype.onBegin = function (context) {
            this.moduleRenames = [];
        };
        /**
         * Triggered when the converter has created a declaration reflection.
         *
         * @param context  The context object describing the current state the converter is in.
         * @param reflection  The reflection that is currently processed.
         * @param node  The node that is currently processed if available.
         */
        ExternalModuleNamePlugin.prototype.onDeclaration = function (context, reflection, node) {
            if (reflection.kindOf(abstract_1.ReflectionKind.ExternalModule)) {
                var comment = comment_1.getRawComment(node);
                // Look for @module
                var match = /@module\s+([\w\-_/@]+)/.exec(comment);
                if (match) {
                    // Look for @preferred
                    var preferred = /@preferred/.exec(comment);
                    // Set up a list of renames operations to perform when the resolve phase starts
                    this.moduleRenames.push({
                        renameTo: match[1],
                        preferred: preferred != null,
                        reflection: reflection
                    });
                }
            }
            CommentPlugin_1.CommentPlugin.removeTags(reflection.comment, 'module');
            CommentPlugin_1.CommentPlugin.removeTags(reflection.comment, 'preferred');
        };
        /**
         * Triggered when the converter begins resolving a project.
         *
         * @param context  The context object describing the current state the converter is in.
         */
        ExternalModuleNamePlugin.prototype.onBeginResolve = function (context) {
            var projRefs = context.project.reflections;
            var refsArray = Object.keys(projRefs).reduce(function (m, k) { m.push(projRefs[k]); return m; }, []);
            // Process each rename
            this.moduleRenames.forEach(function (item) {
                var renaming = item.reflection;
                // Find an existing module that already has the "rename to" name.  Use it as the merge target.
                var mergeTarget = refsArray.filter(function (ref) { return ref.kind === renaming.kind && ref.name === item.renameTo; })[0];
                // If there wasn't a merge target, just change the name of the current module and exit.
                if (!mergeTarget) {
                    renaming.name = item.renameTo;
                    return;
                }
                if (!mergeTarget.children) {
                    mergeTarget.children = [];
                }
                // Since there is a merge target, relocate all the renaming module's children to the mergeTarget.
                var childrenOfRenamed = refsArray.filter(function (ref) { return ref.parent === renaming; });
                childrenOfRenamed.forEach(function (ref) {
                    // update links in both directions
                    ref.parent = mergeTarget;
                    mergeTarget.children.push(ref);
                });
                // If @preferred was found on the current item, update the mergeTarget's comment
                // with comment from the renaming module
                if (item.preferred)
                    mergeTarget.comment = renaming.comment;
                // Now that all the children have been relocated to the mergeTarget, delete the empty module
                // Make sure the module being renamed doesn't have children, or they will be deleted
                if (renaming.children)
                    renaming.children.length = 0;
                CommentPlugin_1.CommentPlugin.removeReflection(context.project, renaming);
                // Remove @module and @preferred from the comment, if found.
                CommentPlugin_1.CommentPlugin.removeTags(mergeTarget.comment, "module");
                CommentPlugin_1.CommentPlugin.removeTags(mergeTarget.comment, "preferred");
            });
        };
        return ExternalModuleNamePlugin;
    }(components_1.ConverterComponent));
    ExternalModuleNamePlugin = __decorate([
        components_1.Component({ name: 'external-module-name' })
    ], ExternalModuleNamePlugin);
    exports.ExternalModuleNamePlugin = ExternalModuleNamePlugin;
});
