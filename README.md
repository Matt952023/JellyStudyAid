# JellyStudyAid
In order to run the AI Quizzer, you must first install venv, and requirements.txt to the project workspace.
This can be done by running these set of commands:

Windows:
py -3 -m venv venv
.\venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt

Linux:
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt

Next, run the FastAPI with the venv active inside the <backend> directory:
uvicorn main:app --reload --host 127.0.0.1 --port 8000


