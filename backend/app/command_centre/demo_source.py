"""Synthetic data for demo visitors. This module must never import the database, the models or
any repository (SC-005; guarded by a test); the dataset is built in memory from a seeded PRNG."""

from datetime import date


class DemoSource:
    def __init__(self, demo_date: date) -> None:
        self.demo_date = demo_date
