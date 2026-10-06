# Smart Timetable Studio

Smart Timetable Studio is a browser application for creating university timetables. It automatically schedules theory classes and lab batches while checking teacher, room, semester, break, availability, and locked-slot constraints.

## What is included?

- Master data for teachers, subjects, rooms, and labs
- Even-semester sample data: 2, 4, 6, and 8
- Odd-semester sample data: 1, 3, 5, and 7
- Semester and section setup
- Lab batch and room assignment
- Teacher availability and daily limits
- Locked timetable slots
- Automatic timetable generation using OR-Tools
- Timetable validation
- Excel export
- Browser auto-save

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | Main web page |
| `app.js` | Frontend logic and timetable display |
| `style.css` | Page styling |
| `main.py` | FastAPI backend and timetable solver |
| `README.md` | Setup and usage instructions |

## Requirements

The project is designed for Windows. Install:

1. Windows 10 or Windows 11
2. Python 3.10 or newer
3. Google Chrome, Microsoft Edge, or Firefox
4. Git, if downloading the project with Git

Check Python:

```powershell
py --version
```

If Python is missing, download it from [python.org](https://www.python.org/downloads/windows/).

During Python installation:

- Enable **Add Python to PATH**
- Complete the installation
- Close and reopen PowerShell

## Install the project on another computer

### Option A: Copy the project folder

Copy the complete `cloud` folder to the new computer using a USB drive, OneDrive, Google Drive, or another file-transfer method.

The copied folder must contain:

```text
cloud/
├── app.js
├── index.html
├── main.py
├── README.md
└── style.css
```

Do not copy the `.venv` folder from another computer. Create a new virtual environment on each computer.

### Option B: Download with Git

If the project is stored in a Git repository:

```powershell
git clone <repository-url>
cd cloud
```

Replace `<repository-url>` with the actual repository URL.

## First-time setup

### 1. Open PowerShell in the project folder

For example:

```powershell
cd C:\Users\YourName\Desktop\cloud
```

Use the real location of the project on your computer.

Confirm that the files are present:

```powershell
Get-ChildItem
```

You should see `app.js`, `index.html`, `main.py`, and `style.css`.

### 2. Create a Python virtual environment

Run this only once:

```powershell
py -m venv .venv
```

### 3. Activate the virtual environment

```powershell
.\.venv\Scripts\Activate.ps1
```

After activation, the PowerShell prompt begins with `(.venv)`.

If PowerShell displays an execution-policy error, run:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Then activate again:

```powershell
.\.venv\Scripts\Activate.ps1
```

### 4. Install the required Python packages

```powershell
python -m pip install --upgrade pip
python -m pip install fastapi "uvicorn[standard]" ortools pydantic
```

The packages are installed inside `.venv`, so they do not affect other Python projects.

## Start the application

The application uses two parts:

- A backend server that runs the timetable solver
- A frontend page that runs in the browser

### 1. Start the backend

In an activated PowerShell window, run:

```powershell
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Keep this window open while using the application.

A successful startup shows a message similar to:

```text
Uvicorn running on http://127.0.0.1:8000
```

Check the backend by opening this address:

<http://127.0.0.1:8000/docs>

The interactive API documentation should appear.

### 2. Open the frontend

Open a second PowerShell window and run:

```powershell
cd C:\Users\YourName\Desktop\cloud
Start-Process .\index.html
```

You can also double-click `index.html` in File Explorer.

Do not close the PowerShell window running Uvicorn. The browser needs it to generate timetables.

## Generate your first timetable

1. Open the **Master Data** tab.
2. Click **Load Sample Data**.
3. Open **Semester Setup**.
4. Choose **Even (2, 4, 6, 8)** or **Odd (1, 3, 5, 7)**.
5. Check that each subject has a **Main Teacher**.
6. Open the **Labs** tab and check lab divisions and rooms.
7. Open the **Timetable** tab.
8. Click **Generate**.
9. Click **Validate** to check for conflicts.
10. Click **Excel** to download the timetable.

The current sample data includes:

- Separate teachers for all even and odd semesters
- Theory rooms for all eight semesters
- Lab rooms for all eight semesters
- Theory subjects and lab subjects
- Main teachers for every subject
- Main teachers and rooms for lab batches

## Daily use after setup

Every time you want to use the application:

### PowerShell window 1

```powershell
cd C:\Users\YourName\Desktop\cloud
.\.venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### PowerShell window 2

```powershell
cd C:\Users\YourName\Desktop\cloud
Start-Process .\index.html
```

## How data is saved

The application automatically saves progress in the browser's local storage.

This means:

- Chrome, Edge, and the VS Code browser have separate saved data.
- Data saved in one browser does not automatically appear in another browser.
- Opening the project in a different browser may show the sample data again.
- **Clear Browser Progress** deletes the saved data for the current browser.
- Use **Save File** to download a project JSON backup.
- Use **Load File** to restore a saved JSON project.

## Main application tabs

### Master Data

Add or edit:

- Teachers
- Subjects
- Theory rooms
- Lab rooms

### Semester Setup

Configure:

- Semesters
- Section
- Working days
- Periods per day
- Period start and end times
- Lunch and break periods
- Fixed theory rooms
- Fixed lab rooms
- Weekly subject sessions
- Main teachers

### Labs

Configure:

- Entire-section or batch-based labs
- Number of batches
- Lab duration
- Batch teachers
- Fixed lab rooms

Co-teachers can be selected automatically by the generator.

### Constraints

Configure:

- Maximum teacher periods per day
- Maximum subject periods per day
- Teacher unavailable slots
- Locked timetable slots

### Timetable

Use this page to:

- Generate the timetable
- Change the selected semester
- Validate conflicts
- Manually edit classes
- Export an Excel file

### Reports

Review:

- Total subjects and timetable rows
- Teacher workload
- Lab assignments
- Automatic co-teacher assignments

## Troubleshooting

### `py` or `python` is not recognized

Install Python from [python.org](https://www.python.org/downloads/windows/), enable **Add Python to PATH**, and reopen PowerShell.

```powershell
py --version
```

### `No module named fastapi`, `uvicorn`, or `ortools`

Activate the environment and install the packages again:

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install fastapi "uvicorn[standard]" ortools pydantic
```

### The `/docs` page does not open

Make sure the backend command is running:

```powershell
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Check that the terminal does not show an error.

### Generate shows an error

Check that:

- The backend is running.
- At least one teacher exists.
- Every subject has a main teacher.
- Every semester has a theory room.
- Lab subjects have lab rooms.
- There are enough periods and working days.
- Teacher availability is not too restrictive.
- The daily teacher limit is not too low.

Read the error message in the browser and the Uvicorn terminal.

### The timetable is blank

Try these steps:

1. Refresh the page with **Ctrl + Shift + R**.
2. Click **Load Sample Data**.
3. Select the required odd or even semester preset.
4. Confirm that the Main Teacher column contains a teacher for every subject.
5. Confirm that the backend is running.
6. Click **Generate** again.

If the browser still shows old data, click **Clear Browser Progress**, confirm, reload the page, and click **Load Sample Data** again.

### Chrome does not show recent changes

Use a hard refresh:

```text
Ctrl + Shift + R
```

If necessary, close the tab, reopen `index.html`, and clear browser progress. Chrome and the VS Code browser maintain separate local storage.

### Port 8000 is already in use

Start the backend on another port:

```powershell
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8001
```

Then change the URL in `app.js` from:

```text
http://localhost:8000/generate-timetable
```

to:

```text
http://localhost:8001/generate-timetable
```

## Stop the application

In the PowerShell window running Uvicorn, press:

```text
Ctrl+C
```

To leave the virtual environment:

```powershell
deactivate
```
