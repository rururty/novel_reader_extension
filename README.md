Novel TTS Reader Extension / 小说朗读插件

This README is bilingual and uses collapsible sections so you can switch between English and Chinese. Click the language title below to expand its content. Only one section needs to be open at a time.

Language / 语言
<details> <summary><strong>English</strong> (click to expand)</summary>
Introduction

Novel TTS Reader is a Chrome extension that reads novels or articles aloud directly from any web page using Volcano Engine’s Speech Synthesis v3 API
. It sends requests to the API from your browser without any proxy, decodes the streaming JSON response and plays the resulting audio.

Features

Read any page – Select text or use the full page content and listen as it’s read aloud.

Direct API calls – Compatible with Volcano Engine’s unidirectional streaming endpoint
npmjs.com
; no server needed.

Multiple voices and formats – Choose a speaker, audio format (mp3, pcm, aac) and sample rate.

Automatic chunking – Long passages are split into manageable segments and synthesized sequentially.

Customizable options – Configure your API key, resource ID, voice and other parameters via a dedicated options page.

Installation

Download or clone this repository.

Open chrome://extensions in Chrome and enable Developer mode.

Click Load unpacked and select the novel_reader_extension folder.

Click the extension icon and select Configure API & Voice to open the options page.

Configuration

On the options page you need to enter your personal API credentials and preferences:

API Key (x-api-key) – Provided by Volcano Engine.

Resource ID – For example volc.service_type.10029.

Speaker (Voice) – e.g. zh_male_beijingxiaoye_emo_v2_mars_bigtts.

Additions – Optional JSON string for advanced features.

Audio format – mp3, pcm or aac.

Sample rate – 8000–48000 Hz (24 kHz recommended).

Maximum characters per API call – Text is split into segments at this length.

Click Save after entering your settings; they will be stored locally.

Usage

Navigate to a web page with text.

Select the text you want to listen to, or leave nothing selected to read the whole page.

Click the extension icon and then Start Reading. The popup shows progress and plays each synthesized segment in order. Press Stop to cancel.

How it works

When you start reading, the extension extracts text from the page, divides it into segments and, for each segment, sends an HTTP POST request to https://openspeech.bytedance.com/api/v3/tts/unidirectional with your credentials and chosen parameters. The API returns a JSON stream where each line contains a Base64‑encoded audio chunk. The extension decodes and concatenates these chunks into an ArrayBuffer, converts it to a Blob and feeds it to an <audio> element for playback.

Troubleshooting

No audio – Ensure the API key, resource ID and speaker are correct and the text length is within the limit.

Cannot extract text – The extension cannot run on certain Chrome pages (e.g. chrome:// URLs). Try a regular website.

Network errors – Temporary network problems or incorrect credentials can cause requests to fail. Test your setup with a manual curl call (see the API docs
npmjs.com
).

License

This project is released under the MIT License.

</details> <details> <summary><strong>中文</strong>（点击展开）</summary>
简介

小说朗读插件 是一个 Chrome 浏览器扩展，通过调用火山引擎语音合成 v3 API
直接将网页上的小说或文章内容朗读出来。扩展在浏览器中直接向接口发送请求，无需任何代理服务器，并解码流式返回的 JSON 音频数据进行播放。

功能特性

朗读任意网页 —— 可以朗读用户选择的文本，也可以朗读整个页面的可见文本。

直接调用 API —— 兼容火山引擎单向流接口
npmjs.com
；所有请求都在本地发起，无需中转服务。

多种音色和格式 —— 在选项页中选择发声人、音频格式（mp3、pcm、aac）和采样率。

自动分段合成 —— 长文本按设置长度自动分段，逐段合成并连续播放。

可配置参数 —— 在专用的设置页面中填写 API Key、资源 ID、发声人及其他参数，满足个性化需求。

安装步骤

下载或克隆此仓库。

在 Chrome 地址栏打开 chrome://extensions，开启 开发者模式。

点击 加载已解压的扩展程序，选择 novel_reader_extension 目录。

点击扩展图标，进入 配置 API 与声音 页面填写相关设置。

配置说明

在设置页面需要输入以下信息：

API Key (x-api-key) —— 从火山引擎控制台获取。

资源 ID —— 例如 volc.service_type.10029。

发声人 —— 例如 zh_male_beijingxiaoye_emo_v2_mars_bigtts。

附加参数 —— 可选 JSON 字符串，用于开启/关闭特性。

音频格式 —— mp3、pcm 或 aac。

采样率 —— 支持 8000–48000 Hz，推荐 24 kHz。

单次请求字符上限 —— 文本会按该长度分段请求。

点击 保存 后配置会保存在本地。

使用方法

打开包含文本的网页。

选中想要朗读的文字，如果未选中则朗读整页文字。

点击扩展图标，然后点击 开始朗读。弹窗会显示进度并自动播放每段合成的音频，点击 停止 可以停止播放。

工作原理

当开始朗读时，扩展从页面提取文本并根据设置的最大长度分段。对于每段文本，扩展向 https://openspeech.bytedance.com/api/v3/tts/unidirectional 发送 POST 请求，携带 API Key、资源 ID、发声人和音频参数。接口返回的响应是流式 JSON，其中每行包含一个 Base64 编码的音频片段。扩展将这些片段解码并拼接成完整的音频缓冲区，再转换为 Blob 对象交给 <audio> 元素播放。

常见问题

没有声音 —— 请确认 API Key、资源 ID、发声人配置正确，且文本长度未超过限制。

无法提取文本 —— 扩展不能在某些内置页面（如 chrome://）运行，请在普通网站上使用。

网络错误 —— 临时网络问题或凭证错误会导致请求失败，可用 API 文档中的 curl 示例验证
npmjs.com
。

许可协议

本项目采用 MIT 许可协议发布。

</details>