export interface BuildConfig
{
    readonly AWSAccountID : string;
    readonly AWSProfileName : string;
    readonly AWSProfileRegion : string;

    readonly App : string;
    readonly Environment : string;
    readonly Version : string;
    readonly Build : string;

    readonly SsmParameterStoreConfig: string;

    readonly Parameters: BuildParameters;
}

export interface BuildParameters
{
    /**
     * @TJS-pattern ^arn:aws:lambda:
     */
    readonly LambdaInsightsLayer : string;
    readonly SomeExternalApiUrl : string;
}