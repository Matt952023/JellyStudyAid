# JellyStudyAid

## Setup

To run the **AI Quizzer**, first create a virtual environment and install dependencies from `requirements.txt`.

> **Note:** Run the install commands from the **project root** (the folder that contains `requirements.txt`).

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

