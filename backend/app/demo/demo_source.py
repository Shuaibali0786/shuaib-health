"""Synthetic data for demo visitors. This module must never import the database, the models or
any repository (SC-005; guarded by a test); the dataset is built in memory from a seeded PRNG."""

from datetime import date

from app.demo import generator
from app.demo.generator import DemoDataset, DemoStaff


class DemoSource:
    def __init__(self, demo_date: date) -> None:
        self.demo_date = demo_date

    @property
    def dataset(self) -> DemoDataset:
        return generator.get_dataset(self.demo_date)

    def staff(self) -> tuple[DemoStaff, ...]:
        return self.dataset.staff
