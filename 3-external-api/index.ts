import cdk = require('@aws-cdk/core');
import { Tags} from '@aws-cdk/core';
import { MainStack } from "./stacks/main";
import { BuildConfig } from "./stacks/lib/build-config";
const yaml = require('js-yaml');
const aws = require('aws-sdk');

const app = new cdk.App();

function setAwsSdkCredentials(profileName: string, region: string)
{
    process.env.AWS_PROFILE = profileName;
    process.env.AWS_DEFAULT_REGION  = region;
}

function ensureString(object: { [name: string]: any }, propName: string ): string
{
    if(!object[propName] || object[propName].trim().length === 0)
        throw new Error(propName +" does not exist or is empty");

    return object[propName];
}

async function getConfig()
{
    let env = app.node.tryGetContext('config');
    if (!env)
        throw new Error("Context variable missing on CDK command. Pass in as `-c config=XXX`");

    let awsProfile = app.node.tryGetContext('profile');
    if (!awsProfile)
        throw new Error("Context variable missing on CDK command. Pass in as `-c profile=XXX`");

    let awsRegion = app.node.tryGetContext('region');
    if (!awsRegion)
        throw new Error("Context variable missing on CDK command. Pass in as `-c region=XXX`");

    setAwsSdkCredentials(awsProfile, awsRegion);

    let ssm = new aws.SSM();
    let ssmParamName = "cdk-multi-environment-3-external-config-"+env;
    console.log("### Getting config from SSM Parameter store with name: " + ssmParamName);
    let ssmResponse = await ssm.getParameter({ Name: ssmParamName }).promise();
    console.log("### Got config!!");
    let unparsedEnv = yaml.load(ssmResponse.Parameter.Value, "utf8");

    let buildConfig: BuildConfig = {
        AWSAccountID: ensureString(unparsedEnv, 'AWSAccountID'),
        AWSProfileName: ensureString(unparsedEnv, 'AWSProfileName'),
        AWSProfileRegion: ensureString(unparsedEnv, 'AWSProfileRegion'),

        App: ensureString(unparsedEnv, 'App'),
        Version: ensureString(unparsedEnv, 'Version'),
        Environment: ensureString(unparsedEnv, 'Environment'),
        Build: ensureString(unparsedEnv, 'Build'),

        Parameters: {
            LambdaInsightsLayer:  ensureString(unparsedEnv['Parameters'], 'LambdaInsightsLayer'),
            SomeExternalApiUrl: ensureString(unparsedEnv['Parameters'], 'SomeExternalApiUrl'),
        }
    };

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