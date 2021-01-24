import cdk = require('@aws-cdk/core');
import { Tags} from '@aws-cdk/core';
import { MainStack } from "./stacks/main";
import { BuildConfig } from "./stacks/lib/build-config";
import * as fs from 'fs';
import * as path from "path";
const yaml = require('js-yaml');
import Ajv from "ajv"

const app = new cdk.App();

function ensureSchema(schema: any, unparsedEnv: any)
{
    const ajv = new Ajv();
    ajv.addSchema(schema);
    let validate = ajv.getSchema("#/definitions/BuildConfig");
    if(!validate)
        throw new Error("Error reading schema");

    let valid = validate(unparsedEnv);
    if (!valid && validate.errors?.length)
        throw new Error(validate.errors[0].dataPath + ":" + validate.errors[0].message);
}

async function getConfig()
{
    let env = app.node.tryGetContext('config');
    if (!env)
        throw new Error("Context variable missing on CDK command. Pass in as `-c config=XXX`");

    let unparsedEnv = yaml.load(fs.readFileSync(path.resolve("./config/build/"+env+".yaml"), "utf8"));
    let schema = JSON.parse(fs.readFileSync(path.resolve("./config/schema.json"), "utf8"));

    ensureSchema(schema, unparsedEnv);

    let buildConfig: BuildConfig = unparsedEnv;
    return buildConfig;
}

async function Main()
{
    let buildConfig: BuildConfig = await getConfig();

    Tags.of(app).add('App', buildConfig.App);
    Tags.of(app).add('Environment', buildConfig.Environment);

    let mainStackName = buildConfig.App + "-" + buildConfig.Environment + "-main";
    const mainStack = new MainStack(app, mainStackName,
        {
            env:
                {
                    region: buildConfig.AWSProfileRegion,
                    account: buildConfig.AWSAccountID
                }
        }, buildConfig);
}
Main();