import {BuildConfig} from "./lib/build-config";
import * as cdk from '@aws-cdk/core';
import * as lambda from "@aws-cdk/aws-lambda";
import * as iam from "@aws-cdk/aws-iam";

export class MainStack extends cdk.Stack
{
    constructor(app: cdk.App, id: string, stackProps: cdk.StackProps, buildConfig: BuildConfig)
    {
        super(app, id, stackProps);

        const isProd: boolean = buildConfig.Environment === "prod";

        function name(name: string): string {
            return id + "-" + name;
        }

        const exampleLambda = new lambda.Function(this, name("example"), {
            functionName: name("example"),
            runtime: lambda.Runtime.NODEJS_12_X,
            code: new lambda.AssetCode('src/lambda/example/'),
            handler: "app.handler",
            environment: {
                SOME_EXTERNAL_API_URL: buildConfig.Parameters.SomeExternalApiUrl,
            },
            timeout: cdk.Duration.seconds(30),
            memorySize: isProd ? 1024 : 128,
            layers: [ lambda.LayerVersion.fromLayerVersionArn(this, name("insight-layer") ,buildConfig.Parameters.LambdaInsightsLayer) ],
            });

        exampleLambda.role?.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLambdaInsightsExecutionRolePolicy')
        );
    }
}

export default MainStack;