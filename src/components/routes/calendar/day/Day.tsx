import React, { useState } from "react";

//types
import { RouteComponentProps } from "react-router-dom";
import {
  RelocateEntrance,
  RelocateEntranceVariables,
} from "../../../../generated/RelocateEntrance";
import {
  Day,
  DayVariables,
  Day_day_assignedStreets,
} from "../../../../generated/Day";

//ui
import {
  Container,
  Drawer,
  makeStyles,
  Toolbar,
  Typography,
  Grid,
  Button,
} from "@material-ui/core";
import Column from "../DND/Column";
import { DragDropContext, DropResult } from "react-beautiful-dnd";

//data
import { useMutation, useQuery } from "@apollo/react-hooks";
import {
  RELOCATE_ENTRANCE,
  DAY,
  ADD_ENTRANCE,
  CHANGE_ASSIGNED_STREETS,
} from "../actions";
import { client } from "../../../../context/client/ApolloClient";

import UnusedHouses from "../DND/UnusedHouses";
import {
  AddEntranceVariables,
  AddEntrance,
} from "../../../../generated/AddEntrance";
import DayMenagerFormModal from "../DayMenagerFormModal";
import { Alert } from "@material-ui/lab";
import {
  ChangeAssignedStreets,
  ChangeAssignedStreetsVariables,
} from "../../../../generated/ChangeAssignedStreets";
import { getKeys } from "../../../Layout/DataTable/util";
import {
  assignDayStateAfterAssignedStreetsChanged,
  replaceTemporaryEntranceWithRealOne,
  assignProperDeletedHousesToDay,
  addTemporaryEntrance,
  relocateEntranceInCache,
  removeAllHousesByStreetInDay,
} from "./cacheActions";
import { difference } from "../../../../utils/diffrence";

const drawerWidth = 240;

type Props = RouteComponentProps<{
  dayId: string;
}>;

const DayManager: React.FC<Props> = ({ match }) => {
  const classes = useStyles();
  const { dayId } = match.params;
  const dayQueryVariables = { input: { id: dayId } };
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const [relocateEntrance] = useMutation<
    RelocateEntrance,
    RelocateEntranceVariables
  >(RELOCATE_ENTRANCE);

  const [changeAssignedStreets] = useMutation<
    ChangeAssignedStreets,
    ChangeAssignedStreetsVariables
  >(CHANGE_ASSIGNED_STREETS, {
    onCompleted: (data) => {
      if (!data.updateDay) return;
      assignDayStateAfterAssignedStreetsChanged(dayId, data.updateDay);
    },
  });

  const [addEntrance] = useMutation<AddEntrance, AddEntranceVariables>(
    ADD_ENTRANCE,
    {
      onCompleted: (data) => {
        if (!data.addEntrance) return;
        replaceTemporaryEntranceWithRealOne(dayId, data.addEntrance);
      },
    }
  );

  const { loading, error, data } = useQuery<Day, DayVariables>(DAY, {
    variables: dayQueryVariables,
    onCompleted({ day }) {
      if (!day) return;
      setTempAssignedStreets([...day.assignedStreets]);
    },
  });

  const [tempAssignedStreets, setTempAssignedStreets] = useState<
    Day_day_assignedStreets[]
  >([]);

  if (loading) return <div>loading...</div>;
  if (error || !data || !data.day) return <div>error</div>;

  const handleModalClose = () => setIsEditing(false);
  const handleModalOpen = () => setIsEditing(true);

  const { pastoralVisits, visitDate, unusedHouses } = data.day;

  const currDate = new Date(visitDate);

  const headerText = `Zaplanuj dzień: ${currDate.toLocaleDateString()}r.`;

  const handleEntranceCreation = (
    houseId: string,
    destinationPastoralVisitIndex: number
  ) => {
    const pastoralVisitId = addTemporaryEntrance(
      dayId,
      houseId,
      destinationPastoralVisitIndex
    );

    if (!pastoralVisitId) return;

    addEntrance({
      variables: {
        houseId,
        pastoralVisitId,
      },
    });
  };

  const handleEntranceRelocation = (
    entranceId: string,
    destinationPastoralVisitIndex: number
  ) => {
    const pastoralVisitId = relocateEntranceInCache(
      dayId,
      entranceId,
      destinationPastoralVisitIndex
    );

    if (!pastoralVisitId) return;

    relocateEntrance({
      variables: {
        id: entranceId,
        to: pastoralVisitId,
      },
    });
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) {
      return;
    }

    if (destination.droppableId === source.droppableId) {
      return;
    }

    const destinationPastoralVisitIndex = data.day!.pastoralVisits.findIndex(
      ({ id }) => id === destination.droppableId
    );

    if (destinationPastoralVisitIndex < 0) return;

    source.droppableId !== "unusedHouses"
      ? handleEntranceRelocation(draggableId, destinationPastoralVisitIndex)
      : handleEntranceCreation(draggableId, destinationPastoralVisitIndex);
  };

  const handleStreetSubmitChange = () => {
    const tempStreetsIds = tempAssignedStreets.map(({ id }) => id);
    const initialStreetsIds = data.day!.assignedStreets.map(({ id }) => id);

    const removedStreetsIds: string[] = difference(
      initialStreetsIds,
      tempStreetsIds
    );

    const areStreetsSame =
      removedStreetsIds.length === 0 &&
      tempStreetsIds.length === initialStreetsIds.length;

    if (areStreetsSame) return;

    changeAssignedStreets({
      variables: { id: dayId, streets: tempStreetsIds },
    });

    const removedHouses = removeAllHousesByStreetInDay(
      dayId,
      removedStreetsIds
    );

    const allQueries = (client.extract() as any).ROOT_QUERY;

    // update rest day queries cache
    getKeys(allQueries).forEach((key) => {
      const queryInfo = allQueries[key];

      if (queryInfo.typename !== "Day" || typeof queryInfo.id !== "string")
        return;

      const currentDayId = queryInfo.id.split(":")[1] as string;

      if (currentDayId === dayId) return;

      assignProperDeletedHousesToDay(
        { input: { id: currentDayId } },
        removedHouses
      );
    });
  };

  return (
    <>
      <DayMenagerFormModal
        open={isEditing}
        headerText={"Zmień ulice"}
        submitText={"Zatwierdz zmiany"}
        selectedStreets={tempAssignedStreets}
        day={currDate}
        infoComponent={
          <Alert severity="warning">
            Usunięcie ulicy spowoduje usunięcie wszyskich domów powiązanych z tą
            ulicą.
          </Alert>
        }
        setSelectedStreets={setTempAssignedStreets}
        onFormSubmit={handleStreetSubmitChange}
        onModalClose={handleModalClose}
      />

      <DragDropContext onDragEnd={onDragEnd}>
        <Drawer
          className={classes.drawer}
          variant="permanent"
          classes={{
            paper: classes.drawerPaper,
          }}
          anchor="left"
        >
          <div className={classes.drawerContainer}>
            <Toolbar />
            <Typography variant={"h6"}>Nieurzywane domy.</Typography>
            <UnusedHouses houses={unusedHouses} />
          </div>
        </Drawer>
        <Container maxWidth={"lg"}>
          <Grid container justify="center" alignItems="center">
            <Grid item xs={10}>
              <Typography variant={"h3"} className={classes.title}>
                {headerText}
              </Typography>
            </Grid>
            <Grid item xs={2}>
              <Button color={"primary"} onClick={handleModalOpen}>
                Dostosuj
              </Button>
            </Grid>
          </Grid>
          <Grid container spacing={3} justify="center">
            {pastoralVisits.map(({ id, priest, entrances }) => (
              <Grid item xs={12} md={2} key={id}>
                <Column
                  droppableId={id}
                  title={
                    priest?.username
                      ? `ks. ${(priest?.username).split(" ")[1]}`
                      : "Brak kapłana"
                  }
                  items={entrances}
                />
              </Grid>
            ))}
          </Grid>
        </Container>
      </DragDropContext>
    </>
  );
};

export default DayManager;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
  },
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
  },
  title: {
    margin: theme.spacing(2, 0, 3, 0),
  },
  drawer: {
    width: drawerWidth,
    flexShrink: 0,
  },
  drawerPaper: {
    width: drawerWidth,
  },
  drawerContainer: {
    overflow: "auto",
  },
  content: {
    flexGrow: 1,
    padding: theme.spacing(3),
  },
}));
