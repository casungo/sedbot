<h1 align="center">
<a href="https://t.me/ssedbot">@ssedbot</a>
</h1>

<p align="center">
<a href="https://www.gnu.org/licenses/gpl-3.0.en.html"><img alt="license" src="https://img.shields.io/github/license/casungo/ssedbot"/></a>
<a href="https://python-telegram-bot.org/"><img alt="framework" src="https://img.shields.io/badge/framework-python--telegram--bot-informational"/></a>
<a href="https://casungo.it"><img alt="author" src="https://img.shields.io/badge/author-casungo-red"/></a>
<a href="https://python.org"><img alt="author" src="https://img.shields.io/badge/language-python-yellow"/></a>
<br>
<br>
<img alt="GitHub stars" src="https://img.shields.io/github/stars/casungo/ssedbot?style=social">
<img alt="GitHub forks" src="https://img.shields.io/github/forks/casungo/ssedbot?style=social">
<img alt="GitHub watchers" src="https://img.shields.io/github/watchers/casungo/ssedbot?style=social">
</p>

## Description
ssedbot is a telegram bot that emulates the sed command used in Unix terminals

<p align="center">
    <img src="https://media.giphy.com/media/MZXKtGOGhRZyTjWp1K/giphy.gif" alt="GIF"> <br>
    <em>How it works</em>
</p>
<br>

From Wikipedia, The Free Encyclopedia: sed (stream editor) is a Unix utility that parses and transforms text, using a simple, compact programming language.


## Contribute!
If you want to help with the project, **go on**!

**Fork the repo, modify the code and submit a PR**.

Help, suggestions and improvements are **always welcome**!


## Installation
To **install** this masterpiece you need: **Python** and **Python-telegram-bot**
Get the version 2.x.x of **Python** [here](https://www.python.org/downloads/release/python-2715/) and install **this release** for your OS.

Then, type this in your home folder:

```
git clone https://github.com/casungo/ssedbot.git

cd ssedbot

python -m pip install -r requirements.txt
```

**Congratulations**, you are ready to start the bot.


### Get the token
We are **not ready** yet, we have to get a new and shiny **HTTP API token** from the father of all bots, [@botfather](https://t.me/botfather).

Type /start to start the bot, then type /newbot to create a new bot and follow all the instructions, **please let the users know that your bot is a fork of this repository by putting the repo link in the description, thanks**. After all of that you will get a piece of text **similar** to this:

```
123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
```

Copy the piece of text that you recived from botfather and **paste it into the config.py** file between the apostrophes, this will tell to the telegram servers wich bot needs to run the code.


## Start the bot
You are ready finally **ready** to start your bot, if you have to do any **modifications** to the code, **do those now** and come back here when you have finished.

In order to fire up the bot you need to type this:

```
python bot.py
```

The bot is now **running**, to do a test, write test, then reply to your message with s/e/oa.
The bot should output:

_I think this is better:_
toast


### Protip: Keep your bot running even when you exit your session
To **prevent** your bot from stopping when you **end your session**, use the **nohup** command in the ssedbot folder:

```
nohup python bot.py &
```

To **stop** the bot that you have started with this command, simply **kill** the _python bot.py_ process


## Need help?
If something doesn't work as expected, **open an issue** here on GitHub or **contact me** at [@casungo](https://t.me/casungo).


## Why did you do this bot?
Simply there wasn't such bot that I could find, so I made one


## Authors and acknowledgment
**[@casungo](https://github.com/casungo)**: Mantainer of the official bot & repo

**@Davide1202**: Coding and telegram implementation


## License
This code uses the [GPL v3](https://www.gnu.org/licenses/gpl-3.0.en.html) License
