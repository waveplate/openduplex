# openduplex
openduplex uses speech-to-text, artificial intelligence and text-to-speech, to call businesses and make appointments for you.

[listen to openduplex booking an appointment for a perm and a wash](https://vocaroo.com/1kKopYVMv3NJ)

[listen to another example](https://vocaroo.com/1frxB3rvGYzw)

![openduplex web ui](https://i.imgur.com/3mPGZUG.png)

openduplex also spawns an expressjs API and a simple web interface for booking appointments, generating call summaries, listening to the call and viewing chat transcripts


# requirements
- SIP account to make VOIP calls
- OpenAI API key (for natural language)
- Deepgram API key (for streaming speech-to-text)
- *optionally*, a ElevenLabs API key (for realistic text-to-speech)
-- otherwise, openduplex can use *espeak* for text-to-speech, which also decreases latency

# setup
### config.env
| env var | example value | description |
| --- | --- | --- |
| `SIP_ACCOUNT` | `<sip:13336669999@sip.sipprovider.com>;auth_pass=YourPassword` | these are your SIP account details from your SIP provider |
| `OPENAI_API_KEY` | `sk-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` | your OpenAI API key |
| `OPENAI_MAX_TOKENS` | `50` | maximum number of tokens to be returned by each request to OpenAI, lower = faster response |
| `OPENAI_TEMPERATURE` | `0` | roughly translates to creativity |
| `DEEPGRAM_API_TOKEN` | `505644d665e2c01ce2b2dfcd61396efa4b2d5a33` | your Deepgram API key |
| `ELEVENLABS_API_KEY` | `c53af3d18ca8188b9d3164e8726a911b` | your ElevenLabs API key |
| `ELEVENLABS_VOICE_ID` | `21m00Tcm4TlvDq8ikWAM` | ElevenLabs voice id, default value is "Rachel" |
| `SPEECH_TTS` | `elevenlabs` or `espeak` | which speech-to-text to use |

### docker
edit `config.env.example` and rename it to `config.env`

then run `docker compose up --force-recreate`

visit `http://localhost:3000`, make an appointment and click 'call'