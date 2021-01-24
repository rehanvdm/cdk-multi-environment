exports.handler = async (event, context) =>
{
    console.log("### Environment:", JSON.stringify(process.env));
    console.log("### Event:", event);
    return true;
};
