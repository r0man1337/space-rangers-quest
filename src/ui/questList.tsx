import * as React from "react";
import { Loader, DivFadeinCss, Tabs } from "./common";
import { LangTexts } from "./lang";
import { DB } from "./db";
import { Player, Lang } from "../lib/qmplayer/player";
import { Index, Game } from "../packGameData";
import {
    ButtonDropdown,
    DropdownMenu,
    DropdownToggle,
    DropdownItem
} from "reactstrap";
import {
    HashRouter,
    Switch,
    Route,
    Redirect,
    RouteComponentProps
} from "react-router-dom";
import { AppNavbar } from "./appNavbar";

interface QuestListState {
    tab: string;
    search: string;
    dropdownOpen: boolean;
}

const ALL = "all";
const OWN = "own";

export class QuestListRouter extends React.Component<
    {
        l: LangTexts;
        index: Index;
        player: Player;
        db: DB,
        firebaseLoggedIn: firebase.User | null | undefined,
    },
    QuestListState
> {
    state = {
        tab: ALL,
        search: "",
        dropdownOpen: false
    };
    render() {
        const {l, firebaseLoggedIn, player, index} = this.props;            

        const origins = index.quests
            .filter(x => x.lang === this.props.player.lang)
            .map(x => x.questOrigin)
            .reduce(
                (acc, d) => (acc.indexOf(d) > -1 ? acc : acc.concat(d)),
                [] as string[]
            );
        
        
        return (
            <Route
                exact
                path={"/quests/"}
                render={prop => {
                    return <>
    <AppNavbar
                                    l={l}
                                    player={player}
                                    firebaseLoggedIn={firebaseLoggedIn}
                                />
                     <DivFadeinCss key="quest list" className="container">
                            <div className="text-center mb-3">
                                <h5>{l.welcomeHeader}</h5>
                            </div>
                            <ButtonDropdown
                                style={{
                                    display: "block"
                                }}
                                isOpen={this.state.dropdownOpen}
                                toggle={() =>
                                    this.setState({
                                        dropdownOpen: !this.state.dropdownOpen
                                    })
                                }
                            >
                                <DropdownToggle color="info" caret block>
                                    {this.state.tab === ALL
                                        ? l.all
                                        : this.state.tab === OWN
                                            ? l.own
                                            : this.state.tab}
                                </DropdownToggle>
                                <DropdownMenu>
                                    <DropdownItem
                                        onClick={() =>
                                            this.setState({ tab: ALL })
                                        }
                                    >
                                        {l.all}
                                    </DropdownItem>
                                    <DropdownItem divider />
                                    {origins.map(originName => (
                                        <DropdownItem
                                            key={originName}
                                            onClick={() =>
                                                this.setState({
                                                    tab: originName
                                                })
                                            }
                                        >
                                            {originName}
                                        </DropdownItem>
                                    ))}
                                    <DropdownItem divider />
                                    <DropdownItem
                                        onClick={() =>
                                            this.setState({ tab: OWN })
                                        }
                                    >
                                        {l.own}
                                    </DropdownItem>
                                </DropdownMenu>
                            </ButtonDropdown>      
                            </DivFadeinCss>
                            </>
                }}
            />
        );
    }
}
