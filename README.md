# JellyStudyAid

## Setup

To run the **AI Quizzer**, first create a virtual environment and install dependencies from `requirements.txt`.

> **Note:** Run the install commands from the **project root** (the folder that contains `requirements.txt`).

You accidentally **never closed your code fences**. In Markdown, everything after an opening `stays inside the code block until you add a matching closing`—so the rest of your text looks “commented out.”

Here’s a fixed version with matching fences, plus a Linux section that mirrors Windows and an added section for running FastAPI on Linux.

### Windows (PowerShell)

```powershell
py -3 -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
````

### Linux (bash)

```bash
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### Run FastAPI (Windows)

```powershell
cd backend
uvicorn main:app --reload --host 127.0.0.1 --port 3001
```

### Run FastAPI (Linux)

```bash
cd backend
uvicorn main:app --reload --host 127.0.0.1 --port 3001
```

````







