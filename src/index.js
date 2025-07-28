import * as core from "@actions/core";
import * as github from "@actions/github";
import axios from 'axios';

import { parseResoniteLogContent, isValidResoniteLog } from './logUtil';

async function run() {
    try {
        const token = core.getInput("github-token", { required: true });
        const messageMissing = core.getInput("reminder-message", { required: true })
        const octkit = github.getOctokit(token);

        const issue = github.context.payload.issue;
        const label = github.context.payload.label?.name;

        if (label === "bug" || label === "prerelease") {
            const issue_number = issue.number;
            const owner = github.context.repo.owner;
            const repo = github.context.repo.repo;

            const labels = issue.labels.map(l => typeof l === "string" ? l : l.name);

            const body = issue.body || "";
            const logSection = body.match(/### Log Files\s*\n+([\s\S]*?)(\n###|$)/i);
            const logField = logSection ? logSection[1].trim() : "";

            const hasLog = /\.log\b/i.test(logField);

            if (!hasLog) {
                await octkit.rest.issues.createComment({
                    owner,
                    repo,
                    issue_number,
                    body: messageMissing,
                });

                if (!labels.includes("needs more information")) {
                    await octkit.rest.issues.addLabels({
                        owner,
                        repo,
                        issue_number,
                        labels: ["needs more information"],
                    });
                }
            } else {
                const logUrls = Array.from(
                    logField.matchAll(/https?:\/\/[^\s)]+?\.log\b/gi),
                    m => m[0]
                );

                let message = 'Hello! Here are the results of the automated log parsing:\n\n';

                let logData = [];
                let isModded = false;

                for (const url of logUrls) {
                    try {
                        const response = await axios.get(url, {
                            headers: {
                                Authorization: `Bearer ${token}`
                            }
                        });
                        let logContent = response.data;

                        // We need this in case someone sends crash logs
                        // player.log and others aren't supported by the
                        // parser at the moment
                        if (!isValidResoniteLog(logContent)) {
                            continue;
                        }

                        let parsedLog = parseResoniteLogContent(logContent);

                        if (parsedLog.modLoader.isLoaded)
                            isModded = true;

                        logData.push(parsedLog);
                    } catch (e) {
                        core.warning(`Unable to download some of the logs, results may be incomplete: ${e.message}`);
                    }
                }

                message += formatMarkdownMessage(logData);

                // This is very ugly but can't do any other way for now
                if (isModded) {
                    message += `\n\n> [!CAUTION]
                It seems your logs contains a mod loader and/or plug-ins being loaded additionally to the base game.
                Please provide clean logs without mods and/or plug-ins to avoid reporting issues related to those.
                If you have any questions about how we process reports, please see the [Resonite Issue Tracker Reporting Guidelines & Requirements](https://github.com/Yellow-Dog-Man/Resonite-Issues/?tab=readme-ov-file#reporting-requirements).
                If you need additional help with your report, you are also welcome to [join our community on Discord](https://discord.gg/resonite).`;
                }

                message += "\n\n---\nThis message has been auto-generated using [logscanner](https://github.com/Yellow-Dog-Man/logscanner-action).";

                await octkit.rest.issues.createComment({
                    owner,
                    repo,
                    issue_number,
                    body: message,
                });
            }
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

function formatMarkdownMessage(data) {
    function resultsTable (res) {
        const headers = ["Version", "OS", "CPU", "GPU", "VRAM", "RAM", "Headset", "Mods", "Clean Exit"];

        const rows = res.map(r => [
            r.resoniteVersion,
            r.operatingSystem,
            r.pcSpecs.cpu,
            r.pcSpecs.gpu,
            r.pcSpecs.vram,
            r.pcSpecs.memory,
            r.headset,
            r.modLoader.isLoaded ? "❌" : "✅",
            r.cleanExit ? "✅" : "❌",
        ]);

        let md = `| ${ headers.join(" | ") } |\n`;
        md += `| ${ headers.map(() => "---").join(" | ") } |\n`;

        for (const row of rows) {
            md += `| ${ row.join(" | ") } |\n`;
        }

        return md;
    }

    if (!Array.isArray(data)) {
        data = [data];
    }

    return resultsTable(data);
}

run();
