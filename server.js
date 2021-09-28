/**
 * Enter your Sendbird information
 */
var APP_ID = '254A27F7-F855-47FF-B343-6D0A1772C4FF';
var USER_ID = 'test1';
var TOKEN = 'dfaf9e02efdb2b80269f81382e9f08cd7addfe34';
var ENTRYPOINT = 'https://api-254A27F7-F855-47FF-B343-6D0A1772C4FF.sendbird.com/v3/bots';


const {v4} = require('uuid');

/**
 * DIALOGFLOW CONFIGURATION
 * 
 * To use this app you must login first with google:
 * gcloud auth application-default login. 
 * 
 * INSTALL gcloud FROM HERE:
 * https://cloud.google.com/sdk/docs/install
*/
var DIALOGFLOW_PROJECT_ID = 'aide-dev-325407';
var DIALOGFLOW_AGENT_ID = '9c1831d5-f0ae-46f0-ba52-00667aef9047';
var GOOGLE_SESSION_ID = v4();
var DIALOGFLOW_LANG = 'en-GB';
var DIALOGFLOW_LOCATION = 'europe-west2';
var DIALOGFLOW_API_ENDPOINT = 'europe-west2-dialogflow.googleapis.com';


/**
 * Sendbird global object
 */
var sb;

/**
 * Include EXPRESS framework 
 * and body parser
 */
const express = require('express');
const app = express();
//const bodyParser = require("body-parser");

/**
 * Use AXIOS for sending and receiving HTTP requests
 */
const axios = require('axios');

/**
 * Install Sendbird
 */
const SendBird = require('sendbird');

/**
 * Install DialogFlow API
 */
// const dialogflow = require('@google-cloud/dialogflow').v2;
//const dialogflow = require('@google-cloud/dialogflow-cx');
const {SessionsClient} = require('@google-cloud/dialogflow-cx');


//const client = new SessionsClient();
const client = new SessionsClient({apiEndpoint: DIALOGFLOW_API_ENDPOINT})


/**
 * Enable Middleware
 */
app.use(express.json()); 
//app.use(bodyParser.json());
//app.use(bodyParser.urlencoded({extended: true}));
app.use(express.urlencoded({extended: true}));


/**
 * Show welcome screen
 */
app.get('/', async (req, res) => {
    res.send(`Welcome to Sendbird `);
});

/**
 * Get bot list
 */
app.get('/bots', async (req, res) => {
    init( async (connected) => {
        if (connected) {
            const bots = await getBotList();
            res.status(200).json(bots);
        } else {
            res.send('Unable to connect to Sendbird.');
        }
    })
});

/**
 * Create bot
 * ============
 * Send a POST request to create a new Bot. These are 
 * some values you can send for creating bot named: bot1
 * {
 *   "bot_userid": "bot1",
 *   "bot_nickname": "bot1",
 *   "bot_profile_url": "https://via.placeholder.com/50x50",
 *   "bot_type": "DialogFlow",
 *   "bot_callback_url": "https://730eb8b5bc29.ngrok.io/callback",
 *   "is_privacy_mode": false
 * }
 */
app.post('/bots', async (req, res) => {
    const body = req.body;
    if (!body.is_privacy_mode) {
        body.is_privacy_mode = false
    }
    init(async (connected) => {
        if (connected) {
            const response = await createBot(body);
            res.status(200).json(response);
        } else {
            res.send('Unable to connect to Sendbird.');
        }
    })
});

/**
 * Update bot
 * ============
 * Send a PUT request to update an existing Bot.
 * {
 *   "bot_userid": "bot1",
 *   "bot_nickname": "bot1",
 *   "bot_profile_url": "https://via.placeholder.com/50x50",
 *   "bot_type": "DialogFlow",
 *   "bot_callback_url": "http://localhost:5500",
 *   "is_privacy_mode": false
 * }
 */
app.put('/bots/:id', async (req, res) => {
    const body = req.body;
    init(async (connected) => {
        if (connected) {
            const response = await updateBot(req.params.id, body);
            res.status(200).json(response);
        } else {
            res.send('Unable to connect to Sendbird.');
        }
    })
});

/**
 * Add bot to channel
 * ===================
 * Once you create a bot you can add it to one of your channels.
 * Send a GET request to do that.
 */
app.get('/bots/:channel_url/:bot_id', async (req, res) => {    
    const botId = req.params.bot_id;
    const channelUrl = req.params.channel_url;
    addBotToChannel(botId, channelUrl);
    res.status(200).json({
        message: 'Bot ' + botId + ' added to channel ' + channelUrl
    });
});

/**
 * Sendbird's Platform API runs this POST request when 
 * a user sends a message. We receive that message and
 * send to DIALOGFLOW.
 */
app.post('/callback', express.json(), async (req, res) => {
    console.log('Message receieved via /callback')
    const { message, bot, channel } = req.body;
    if (message && bot && channel) {
        /**
         * Get bot id and channel url
         */
        const botId = bot.bot_userid;
        const channelUrl = channel.channel_url;
        /**
         * Get input text and send to dialogflow
         */
        const msgText = message.text;
        console.log('Sending to DialogFlow...');
        console.log(msgText);
        /**
         * Send user message from Sendbird to dialogflow
         */
        sendToDialogFlow(msgText, async (responseMessages) => {

            for (const responseMessage of responseMessages) {
                /**
                //  * Lastly, send Dialogflow responses to chat using our Bot
                //  */
                if (responseMessage.message == "text" && responseMessage.text) {
                    await fromDialogFlowSendMessageToChannel(responseMessage.text.text, channelUrl, botId);
                } else if (responseMessage.message == "payload" && responseMessage.payload) {
                    await fromDialogFlowSendPayloadToChannel(responseMessage.payload, channelUrl, botId);
                }
            
            }
            /**
             * Respond HTTP OK (200)
             */
            res.status(200).json({
                message: 'Response from DialogFlow: ' + responseMessages
            });        
        });
    } else {
        res.status(200).json({
            message: 'Wrong format'
        });
    }
});

app.listen(5500, () => console.log('Sendbid DialogFlow BOT listening on port 5500!'));

/**
 * HELPER FUNCTIONS
 */
function init(callback) {
    sb = new SendBird({appId: APP_ID});
    sb.connect(USER_ID, function(user, error) {
        if (error) {
            console.log('Error connecting to sendbird'); 
            callback(false);
        } else {
            console.log('You are connected now');
            callback(true);
        }
    });
}

async function getBotList() {
    const response = await axios.get(ENTRYPOINT, {
        headers: { 
            "Api-Token": TOKEN,
            'Content-Type': 'application/json'
        }
    });
    const data = response.data
    return data;
}

async function createBot(params) {
    const response = await axios.post(ENTRYPOINT, params, {
        headers: { 
            "Api-Token": TOKEN,
            'Content-Type': 'application/json'
        },
    });
    const data = response.data
    return data.bots;
}

async function updateBot(botId, params) {
    const response = await axios.put(ENTRYPOINT + '/' + botId, params, {
        headers: { 
            "Api-Token": TOKEN,
            'Content-Type': 'application/json'
        },
    });
    const data = response.data
    return data.bots;
}

async function addBotToChannel(botId, channelUrl) {
    const params = {
        'channel_urls': [ channelUrl ]
    };
    const response = await axios.post(ENTRYPOINT + '/' + botId + '/channels', params, {
        headers: { 
            "Api-Token": TOKEN,
            'Content-Type': 'application/json'            
        },
    });
    const data = response.data;
    return data;
}

async function fromDialogFlowSendMessageToChannel(messageText, channelUrl, botId) {
   
    const params = {
        message: String(messageText),
        channel_url: channelUrl
    }

    await axios.post(ENTRYPOINT + '/' + botId + '/send', params, {
        headers: { 
            "Api-Token": TOKEN,
            'Content-Type': 'application/json'
        },
    });
}

async function fromDialogFlowSendPayloadToChannel(queryPayload, channelUrl, botId) {
   
    const params = {
        message: '{This is a Payload}',
        data: String(queryPayload),
        channel_url: channelUrl
    }
    await axios.post(ENTRYPOINT + '/' + botId + '/send', params, {
        headers: { 
            "Api-Token": TOKEN,
            'Content-Type': 'application/json'
        },
    });
}

function sendToDialogFlow(message, callback) {
    try {
        const queries = [
            message
        ];
        const response = executeQueries(DIALOGFLOW_PROJECT_ID, DIALOGFLOW_AGENT_ID, queries, DIALOGFLOW_LANG, DIALOGFLOW_LOCATION, callback);    
        return response;
    } catch (error) {
        console.log(error)
    }
}

async function executeQueries(projectId, agentId, queries, languageCode, location, callback) {
    let intentResponse;
    for (const query of queries) {
        try {
            intentResponse = await detectIntent(
                projectId,
                agentId,
                query,
                languageCode, 
                location
            );
            
            console.log(intentResponse.queryResult);

            callback(intentResponse.queryResult.responseMessages);

            if (intentResponse.queryResult.match.intent) {
                console.log(
                    `Matched Intent: ${intentResponse.queryResult.match.intent.displayName}`
                );
            }
        } catch (error) {
            console.log(error);
            callback('Error from DialogFlow: ' + error);
        }
    }
}

async function detectIntent(projectId, agentId, query, languageCode, location) {
    const sessionId = GOOGLE_SESSION_ID 
    const sessionPath = client.projectLocationAgentSessionPath(
        projectId,
        location,
        agentId,
        sessionId
      );
    const request = {
        session: sessionPath,
        queryInput: {
        text: {
            text: query,
        },
        languageCode,
        },
    };
    const responses = await client.detectIntent(request);
    return responses[0];
}
