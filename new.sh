# --- MISSION: THE RESIDENT ---

# MISSION STEP 1: PUSH TO GITHUB
# ---------------------------------------------------------
# Run these commands one by one in your terminal to sync with your repo:

# If 'origin' already exists, you might need: git remote remove origin
git remote add origin https://github.com/TEARN1/TheResident.git
git add .
git commit -m "Deployment Mission: Stage 1 - GitHub"
git push -u origin main

# MISSION STEP 2: PREPARE GOOGLE CLOUD
# ---------------------------------------------------------
# 1. Open 'Google Cloud SDK Shell' from your Start Menu
# 2. Run: gcloud auth login
# 3. Run: gcloud projects list (Copy your PROJECT_ID)

# MISSION STEP 3: BUILD & DEPLOY (DOCKER TO CLOUD RUN)
# ---------------------------------------------------------
# Replace YOUR_PROJECT_ID below with your actual ID before running:

gcloud builds submit --tag gcr.io/754529663410/the-resident
gcloud run deploy the-resident --image gcr.io/754529663410/the-resident --platform managed --region us-central1 --allow-unauthenticated --port 3000
