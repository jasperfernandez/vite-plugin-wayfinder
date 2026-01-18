import { exec } from "child_process";
import { minimatch } from "minimatch";
import osPath from "path";
import { PluginContext } from "rollup";
import { promisify } from "util";
import { HmrContext, Plugin } from "vite";

const execAsync = promisify(exec);

interface WayfinderOptions {
    patterns?: string[];
    actions?: boolean;
    routes?: boolean;
    formVariants?: boolean;
    path?: string;
    command?: string;
    generate?: boolean;
}

let context: PluginContext;

export const wayfinder = ({
    patterns = ["routes/**/*.php", "app/**/Http/**/*.php"],
    actions = true,
    routes = true,
    formVariants = false,
    path,
    command = "php artisan wayfinder:generate",
    generate = true,
}: WayfinderOptions = {}): Plugin => {
    patterns = patterns.map((pattern) => pattern.replace("\\", "/"));

    const args: string[] = [];
    const generating: string[] = [];

    if (!actions) {
        args.push("--skip-actions");
    } else {
        generating.push("actions");
    }

    if (!routes) {
        args.push("--skip-routes");
    } else {
        generating.push("routes");
    }

    if (formVariants) {
        args.push("--with-form");
        generating.push("form variants");
    }

    if (path) {
        args.push(`--path=${path}`);
    }

    const runCommand = async () => {
        if (!generate) {
            context.info("Wayfinder auto-generation is disabled");
            return;
        }

        try {
            await execAsync(`${command} ${args.join(" ")}`);
        } catch (error) {
            context.error("Error generating types: " + error);
        }

        context.info(`Types generated for ${generating.join(", ")}`);
    };

    return {
        name: "@laravel/vite-plugin-wayfinder",
        enforce: "pre",
        buildStart() {
            context = this;
            return runCommand();
        },
        async handleHotUpdate({ file, server }) {
            if (shouldRun(patterns, { file, server })) {
                await runCommand();
            }
        },
    };
};

const shouldRun = (
    patterns: string[],
    opts: Pick<HmrContext, "file" | "server">,
): boolean => {
    const file = opts.file.replaceAll("\\", "/");

    return patterns.some((pattern) => {
        pattern = osPath
            .resolve(opts.server.config.root, pattern)
            .replaceAll("\\", "/");

        return minimatch(file, pattern);
    });
};
