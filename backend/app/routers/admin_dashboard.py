"""Read screens of the Command Centre that are not bookings: filter lookups now; overview,
insights, doctors today and activity are added by their own stories."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response

from app.auth.deps import Viewer, get_source, require_viewer
from app.auth.policies import Policy
from app.command_centre.schemas import Lookups
from app.db import SessionDep
from app.deps import ADMIN_ERRORS_DOC

router = APIRouter(prefix="/admin", tags=["command-centre"])


@router.get(
    "/lookups",
    response_model=Lookups,
    response_model_exclude_none=True,
    responses=ADMIN_ERRORS_DOC,
    operation_id="adminLookups",
    summary="Doctors and departments for the filters",
)
def lookups(
    viewer: Annotated[Viewer, Depends(require_viewer(Policy.READ))],
    db: SessionDep,
    response: Response,
) -> Lookups:
    response.headers["Cache-Control"] = "no-store"
    return get_source(viewer, db).lookups()
