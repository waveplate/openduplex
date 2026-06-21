import { Configuration, OpenAIApi } from "openai";
import textToSpeech from 'elevenlabs-api';
import WebSocket from 'ws';
import fs from 'fs';
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
    case '60db':
      sixtydb(text, '/tmp/output.wav', `${__dirname}/error.mp3`);
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

// Wraps raw LINEAR16 (16-bit signed, mono) PCM in a canonical 44-byte WAV header
// so the concatenated 60db audio chunks can be played by cvlc like any other file.
const wavHeader = (dataLength: number, sampleRate: number): Buffer => {
  const channels = 1;
  const bitsPerSample = 16;
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);          // PCM fmt chunk size
  header.writeUInt16LE(1, 20);           // audio format = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);
  return header;
};

// 60db TTS over the websocket API. Mirrors the elevenlabs path: synthesise the full
// utterance, write it to a file, then play it with cvlc into the call's audio sink.
const sixtydb = (text: string, audio_save_path: string, error_audio_path: string): void => {
  const sampleRate = 24000;
  const contextId = `ctx-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  const voiceId = process.env.SIXTYDB_VOICE_ID || 'fbb75ed2-975a-40c7-9e06-38e30524a9a1';
  const url = `ws://api.60db.ai/ws/tts?apiKey=${encodeURIComponent(process.env.SIXTYDB_API_KEY)}`;

  const chunks: Array<Buffer> = [];
  let settled = false;

  const fail = (error): void => {
    if (settled) return;
    settled = true;
    console.log("60db tts error", error);
    exec(`cvlc --play-and-exit ${error_audio_path}`);
    try { ws.close(); } catch (e) { /* already closing */ }
  };

  const ws = new WebSocket(url);

  ws.on('open', () => {
    ws.send(JSON.stringify({
      create_context: {
        context_id: contextId,
        voice_id: voiceId,
        audio_config: {
          audio_encoding: 'LINEAR16',
          sample_rate_hertz: sampleRate,
        },
      },
    }));
  });

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (e) {
      return; // ignore non-JSON frames
    }

    if (msg.context_created) {
      ws.send(JSON.stringify({ send_text: { context_id: contextId, text } }));
      ws.send(JSON.stringify({ flush_context: { context_id: contextId } }));
    } else if (msg.audio_chunk) {
      chunks.push(Buffer.from(msg.audio_chunk.audioContent, 'base64'));
    } else if (msg.flush_completed) {
      ws.send(JSON.stringify({ close_context: { context_id: contextId } }));

      if (settled) return;
      settled = true;

      const pcm = Buffer.concat(chunks);
      const wav = Buffer.concat([wavHeader(pcm.length, sampleRate), pcm]);
      fs.writeFile(audio_save_path, wav, (error) => {
        if (error) {
          console.log("60db write error", error);
          exec(`cvlc --play-and-exit ${error_audio_path}`);
        } else {
          exec(`cvlc --play-and-exit ${audio_save_path}`, (err) => {
            if (err)
              console.log(`cvlc error: ${err.message}`);
          });
        }
        try { ws.close(); } catch (e) { /* already closing */ }
      });
    } else if (msg.error) {
      fail(msg.error.message || msg.error);
    }
  });

  ws.on('error', (error) => fail(error));
};

