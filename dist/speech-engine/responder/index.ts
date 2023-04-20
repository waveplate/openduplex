import { Configuration, OpenAIApi } from "openai";
import textToSpeech from 'elevenlabs-api';
import { exec } from 'child_process';

const config = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});

const openai = new OpenAIApi(config);

const template = `You are [NAME]'s assistant who is calling a business to make an appointment for [SERVICE].
Be friendly and answer in short, concise sentences.
The appointment is for [TIME]. If that time doesn't work, there is also availability on [AVAILABILITY].
You are only going to contribute one side of the conversation. Only answer with one sentence.
Be conversational, and don't give all the information right away.
When the conversation begins, you will try to make an appointment as described.`;

export class PhoneConvo {
  rid: Number;
  log: Array<any>;
  startTime: Number;
  endTime: Number;
  summary: String;

  constructor(fields: object) {
    this.rid = Math.floor(Math.random() * 1000000);
    this.log = [];
    this.startTime = -1;
    this.endTime = -1;

    let systemMessage = template;
    Object.keys(fields).forEach(key => {
      const rxp = new RegExp(`\\[${key}\\]`, 'g')
      systemMessage = systemMessage.replace(rxp, fields[key]);
    });

    this.addEntry('system', systemMessage);
  }

  last(): object {
    return this.log[this.log.length - 1];
  }

  respond(text: string, cb: Function): void {
    if (this.startTime == -1)
      this.startTime = Date.now();
    this.addEntry('user', text);
    return chatgpt(
      this.log,
      data => {
        this.addEntry('assistant', data.message.content);
        cb(data.message);
      },
      error => {
        console.log(error);
        return "";
      }
    );
  }

  addEntry(role: string, content: string): void {
    this.log.push({ role, content });
  }
}

export const speak = (text: string): void => {
  switch (process.env.SPEECH_TTS) {
    case 'espeak':
      espeak(text);
      break;
    case 'elevenlabs':
      elevenlabs(text, '/tmp/output.mp3', `${__dirname}/error.mp3`);
      break;
    default:
      break;
  }
};

export const chatgpt = (messages: Array<any>, cb: Function, err: Function): any => {
  console.log("sending messages:");
  console.log(JSON.stringify(messages));
  const completion = openai.createChatCompletion(
    {
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS),
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE)
    }
  )
    .then(data => {
      cb(data.data.choices[0]);
    })
    .catch(error => {
      err(error);
    });
};

export const summarise = (messages: Array<any>, cb: Function, err: Function): any => {
  console.log("sending messages:");
  console.log(JSON.stringify(messages));

  let buf = `Below is an interaction between a business and an assistant.
Summarise the conversation in concise natural language, including only: the service, the time of the appointment, and any extra information relayed by the business.
If the interaction below did not produce an appointment, state what was missing as your summary.\n\n`;

  messages.forEach(message => {
    if (message.role != 'system') {
      buf += (message.role == 'user') ? 'Business: ' : 'Assistant: ';
      buf += message.content + "\n";
    }
  });

  console.log(buf);

  openai.createChatCompletion(
    {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: buf }],
      temperature: 0
    }
  )
    .then(data => {
      cb(data.data.choices[0]);
    })
    .catch(error => {
      err(error);
    });
};

const espeak = (text: string): void => {
  text = text.replace(/"/g, '\\"');
  exec(`espeak "${text}"`, (error, stdout, stderr) => {
    if (error)
      console.log(`espeak error: ${error.message}`);
  });
};

const elevenlabs = (text: string, audio_save_path: string, error_audio_path: string): void => {
  textToSpeech(
    process.env.ELEVENLABS_API_KEY,
    text,
    process.env.ELEVENLABS_VOICE_ID,
    audio_save_path
  )
    .then(() => {
      exec(`cvlc --play-and-exit ${audio_save_path}`, (error, stdout, stderr) => {
        if (error)
          console.log(`cvlc error: ${error.message}`);
      });
    })
    .catch((error) => {
      exec(`cvlc --play-and-exit ${error_audio_path}`);
      console.log("elevenlabs tts error", error);
    });
};

