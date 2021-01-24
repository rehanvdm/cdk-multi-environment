export interface BuildConfig
{
    readonly AWSAccountID : string;
    readonly AWSProfileName : string;
    readonly AWSProfileRegion : string;

    readonly App : string;
    readonly Environment : string;
    readonly Version : string;
    readonly Build : string;

    readonly Parameters: Parameters;
}


export interface Parameters
{
    readonly LambdaInsightsLayer : string;
    readonly SomeExternalApiUrl : string;
}