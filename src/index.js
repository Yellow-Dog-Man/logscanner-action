import * as core from "@actions/core";
import * as github from "@actions/github";
import axios from 'axios';

import { parseResoniteLogContent, getSystemSummary } from './logUtil';

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

                for (const url of logUrls) {
                    try {
                        const response = await axios.get(url, {
                            headers: {
                                Authorization: `Bearer ${token}`
                            }
                        });

                        let parsedLog = parseResoniteLogContent(response.data);
                        let systemSummary = getSystemSummary(parsedLog);

                        message += `Found logs for Resonite ${parsedLog.resoniteVersion}:\n- CPU: ${systemSummary.cpu}\n- GPU: ${systemSummary.gpu}\n- Headset: ${systemSummary.vrMode}\n`;

                        if (systemSummary.modded) {
                            message += "> [!CAUTION]\n> We have detected a mod loader and/or plug-ins being loaded additionally to the base game. Please provide clean logs without mods and/or plug-ins to avoid reporting issues related to those.";
                        }
                    } catch (e) {
                        core.warning(`Unable to download some of the logs, results may be incomplete: ${e.message}`);
                    }
                }

                message += "\n\nThis message has been auto-generated using [logscanner](https://github.com/Yellow-Dog-Man/logscanner-action).";

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

run();
