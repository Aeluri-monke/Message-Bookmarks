# 🔖 Message Bookmarks & Search

A SillyTavern extension for manually bookmarking key moments in a chat and searching across the whole conversation — no more scrolling forever or fighting the browser's Ctrl+F.

## Features

**🔍 Search**
Live search across the entire chat as you type. Shows sender + a highlighted snippet for every match, most recent first. Click a result to jump straight to it.

**⭐ Manual bookmarks**
Hover any message → click the 🔖 icon in its button row → give it a label and a category. Bookmarks are saved with a smooth-scroll + flash-highlight jump, so you never lose your place in a long thread.

**Categories**
| Emoji | Category |
|---|---|
| 💋 | Romantic |
| ⚔️ | Conflict |
| 😭 | Emotional |
| 🎲 | Plot |
| 📌 | Other |

Filter the bookmark list by category with the chip row at the top of the Bookmarks tab.

**Persistence**
Bookmarks live in the chat's own metadata, so they save and travel with the chat file itself — export the chat, and the bookmarks go with it.

## Usage

- Click the floating 🔖 button (bottom right) to open the panel
- **Search tab** — type to search, click a result to jump
- **Bookmarks tab** — filter by category, click a bookmark to jump, ✕ to delete
- Toggle the extension on/off from its settings drawer in the Extensions panel

## Notes

- If a bookmarked or searched message isn't currently rendered in the chat view, you'll get a toast warning — scroll near it first, then try again.
- Uses SmartTheme CSS variables throughout, so it should adapt to whatever ST theme you're running.
