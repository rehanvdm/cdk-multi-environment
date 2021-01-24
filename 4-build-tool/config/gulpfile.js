const gulp = require('gulp');

const spawn = require('child_process').spawn;
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv').default;
const aws = require('aws-sdk');

const paths = {
    workingDir: path.resolve(__dirname + "/.."),
    srcConfigPath: (env) => path.resolve("./src/"+env+".yaml"),
    buildConfigPath: (env) => path.resolve("./build/"+env+".yaml"),
    configSchemaPath: path.resolve("./schema.json"),
};

function setAwsSdkCredentials(profileName, region)
{
    process.env.AWS_PROFILE = profileName;
    process.env.AWS_DEFAULT_REGION  = region;
    aws.config.update({region: region});
}

async function commandExec(command, args, cwd, echoOutputs = true)
{
    console.log(">>>", command, args);
    return new Promise((resolve, reject) =>
    {
        var allData = "";
        const call = spawn(command, args, {shell: true, windowsVerbatimArguments: true, cwd: cwd});
        var errOutput = null;
        
        call.stdout.on('data', function (data)
        {
            allData += data.toString();
            echoOutputs && process.stdout.write(data.toString());
        });
        call.stderr.on('data', function (data)
        {
            errOutput = data.toString();
            echoOutputs && process.stdout.write(data.toString());
        });
        call.on('exit', function (code)
        {
            if (code == 0)
                resolve(allData);
            else
                reject(errOutput);
        });
    });
}

async function getEnvFromBranchName()
{
    let env = null;

    let branchName = await commandExec("git", ("symbolic-ref --short HEAD").split(' '), paths.workingDir);
    branchName = branchName.replace(/[\n\r]/gm,'');

    if(!branchName)
        throw new Error("getConfig env parameter not passed and git branchName can not be resolved");

    /* If master branch assign prod, for the rest each branchName represents an env */
    if(branchName === "master")
        env = "prod";
    else
        env = branchName;

    return env;
}

function validateConfig(unparsedConfig)
{
    let ajv = new Ajv({allErrors: false});
    let schema = JSON.parse(fs.readFileSync(paths.configSchemaPath, "utf8"));

    ajv.addSchema(schema)
    let validate = ajv.getSchema("#/definitions/BuildConfig");

    let valid = validate(unparsedConfig);
    if (!valid)
        throw new Error(validate.errors[0].dataPath + ":" + validate.errors[0].message);

    return unparsedConfig;
}

async function getSsmConfig(ssmParamName)
{
    let ssm = new aws.SSM();
    console.log("### Getting config from SSM Parameter store with name: " + ssmParamName);
    let ssmResponse = await ssm.getParameter({ Name: ssmParamName }).promise();
    console.log("### Got config!!");
    let ssmConfig = yaml.load(ssmResponse.Parameter.Value, "utf8");

    return ssmConfig;
}

async function generateConfig(env)
{
    /* If ENV is not passed, then use the branch name */
    if (!env)
        env = await getEnvFromBranchName();

    /* Load local config and set AWS credentials for all AWS SDK commands */
    let localConfig = yaml.load(fs.readFileSync(paths.srcConfigPath(env), "utf8"));
    setAwsSdkCredentials(localConfig['AWSProfileName'], localConfig['AWSProfileRegion']);

    /* Get the LambdaInsightsLayer config property from the "Global" config and add to our "Local" config */
    let ssmParamName = localConfig["SsmParameterStoreConfig"];
    let ssmConfig = await getSsmConfig(ssmParamName);
    localConfig["Parameters"]["LambdaInsightsLayer"] = ssmConfig["LambdaInsightsLayer"];

    /* Make sure the Object is valid according to the TS interface at /stacks/lib/BuildConfig */
    validateConfig(localConfig);

    /* Write complete config to be consumed by CDK */
    fs.writeFileSync(paths.buildConfigPath(env), yaml.dump(localConfig));

    /* Reading after writing to ensure file is written and working */
    return getBuildConfig(env);
}



function getBuildConfig(env)
{
    /* If ENV is not passed, then use the branch name */
    if (!env)
        env = getEnvFromBranchName();

    return yaml.load(fs.readFileSync(paths.buildConfigPath(env), "utf8"));
}

gulp.task('bootstrap', async () =>
{
    try
    {
        await commandExec("npm", ["run build"], paths.workingDir);  /* Convert TSC to JS and create config schema */

        let config = await generateConfig();

        /* Potentially build your lambdas (like npm install and tree shaking) with prod config and output to somewhere
         * like `/build/lambda/*`. Just make sure to update the CDK code to point to the new `/build` dir instead of `/src` */

        await commandExec("cdk", ["synth -c config=" + config.Environment + " --profile " + config.AWSProfileName], paths.workingDir);
        await commandExec("cdk", ["bootstrap --profile " + config.AWSProfileName], paths.workingDir);

        return true;
    }
    catch (e) {
        console.error(e);
    }
});

gulp.task('generate_diff', async () =>
{
    try
    {
        await commandExec("npm", ["run build"], paths.workingDir);   /* Convert TSC to JS and create config schema */

        let config = await generateConfig();

        /* Potentially build your lambdas (like npm install and tree shaking) with prod config and output to somewhere
         * like `/build/lambda/*`. Just make sure to update the CDK code to point to the new `/build` dir instead of `/src` */

        await commandExec("cdk", ["diff -c config=" + config.Environment + " --profile " + config.AWSProfileName], paths.workingDir);
    }
    catch (e) {
        console.error(e);
    }
});

gulp.task('deploy_SKIP_APPROVAL', async () =>
{
    try
    {
        await commandExec("npm", ["run build"], paths.workingDir);   /* Convert TSC to JS and create config schema */

        let config = await generateConfig();

            /* Potentially build your lambdas (like npm install and tree shaking) with prod config and output to somewhere
             * like `/build/lambda/*`. Just make sure to update the CDK code to point to the new `/build` dir instead of `/src` */

        await commandExec("cdk", ["deploy \"*\" -c config=" + config.Environment + " --profile " + config.AWSProfileName +
                                                " --require-approval=never --progress=events"], paths.workingDir);
    }
    catch (e) {
        console.error(e);
    }
});


