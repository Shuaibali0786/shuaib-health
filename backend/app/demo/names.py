"""Sample names and visit reasons for the demo dataset (FR-038).

Obviously sample: first names plus a surname, nothing that identifies a real person. The lists
match the approved design preview (specs/006-clinic-command-centre/design-preview/data.js), so a
patient fits the department they are booked with: Gynecology sees women, Pediatrics sees children
brought by their mother or father.
"""

from typing import Final, Literal

Who = Literal["adult", "woman", "child"]

WOMEN: Final = (
    "Ayesha", "Fatima", "Hira", "Zara", "Sadia", "Mahnoor", "Nimra", "Amna", "Iqra", "Rabia",
    "Maryam", "Khadija", "Saba", "Mehwish", "Noor", "Areeba", "Javeria", "Sana",
)  # fmt: skip
MEN: Final = (
    "Bilal", "Usman", "Ahmed", "Kamran", "Hamza", "Faraz", "Saad", "Danish", "Talha", "Yasir",
    "Ali", "Junaid", "Fahad", "Waqas", "Zubair", "Asad",
)  # fmt: skip
GIRLS: Final = (
    "Inaya", "Hoorain", "Anaya", "Eshal", "Haniya", "Alishba", "Zoya", "Fiza", "Minahil", "Aiza",
)  # fmt: skip
BOYS: Final = (
    "Ayaan", "Zayan", "Rayyan", "Musa", "Arham", "Ibrahim", "Abdullah", "Hadi", "Shayan", "Azlan",
)  # fmt: skip
SURNAMES: Final = (
    "Khan", "Siddiqui", "Tariq", "Shah", "Raza", "Hussain", "Malik", "Iqbal", "Javed", "Aslam",
    "Butt", "Rehman", "Nadeem", "Akhtar", "Anwar", "Latif", "Baig", "Zaidi",
)  # fmt: skip

# Who each department sees (age range inclusive) and why they come.
PROFILES: Final[dict[str, tuple[Who, tuple[int, int]]]] = {
    "General Medicine": ("adult", (18, 70)),
    "Cardiology": ("adult", (38, 78)),
    "Pediatrics": ("child", (0, 12)),
    "Gynecology": ("woman", (21, 46)),
    "Dermatology": ("adult", (14, 65)),
    "Dental": ("adult", (16, 72)),
    "Pathology Lab": ("adult", (18, 75)),
}
REASONS: Final[dict[str, tuple[str, ...]]] = {
    "General Medicine": (
        "Fever and cough",
        "Blood pressure review",
        "Follow-up visit",
        "Routine check-up",
        "Prescription renewal",
        "Skin rash",
        "Annual review",
    ),
    "Cardiology": (
        "Chest discomfort",
        "ECG review",
        "Blood pressure review",
        "Palpitations",
        "Follow-up after echo",
    ),
    "Pediatrics": (
        "Vaccination",
        "Fever",
        "Growth check",
        "Ear pain",
        "Well-child check-up",
        "Cough and cold",
    ),
    "Gynecology": (
        "Antenatal check-up",
        "Ultrasound review",
        "Follow-up visit",
        "Annual check-up",
        "Menstrual concerns",
    ),
    "Dermatology": (
        "Acne review",
        "Skin rash",
        "Hair fall",
        "Follow-up visit",
        "Mole check",
        "Eczema flare-up",
    ),
    "Dental": ("Tooth pain", "Scale and polish", "Filling", "Dental check-up", "Braces review"),
    "Pathology Lab": (
        "Blood test review",
        "Sample collection",
        "Report discussion",
        "Thyroid profile review",
        "Diabetes screening",
    ),
}
STAFF: Final = (
    ("Sample Admin", "admin", "sample.admin@example.com"),
    ("Sample Receptionist A", "receptionist", "sample.reception.a@example.com"),
    ("Sample Receptionist B", "receptionist", "sample.reception.b@example.com"),
)
